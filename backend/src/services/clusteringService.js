import Report from "../models/Report.js";
import ReportCluster from "../models/ReportCluster.js";
import { geoToLatLng } from "../utils/geo.js";
import {
  CLUSTER_DEFAULTS,
  computeCentroid,
  deriveClusterStatus,
  dominantValue,
  pickCluster,
} from "../utils/clusterMath.js";

// Cancelled reports never belong to a cluster.
const toMember = (report) => ({
  id: report._id,
  point: geoToLatLng(report.geo),
  embedding: report.embedding ?? null,
  district_id: report.district_id,
  status_id: report.status_id,
});

const loadMembers = async (ids) => {
  const reports = await Report.find({
    _id: { $in: ids },
    status_id: { $ne: "cancelled" },
  })
    .select("+embedding")
    .sort({ created_dt: 1 });
  return reports.map(toMember);
};

// Cluster fields derived from its members. Pure function.
export const buildClusterFields = (members) => {
  const { point, embedding } = computeCentroid(members);
  return {
    centroid: { type: "Point", coordinates: [point.lng, point.lat] },
    centroid_embedding: embedding ?? undefined,
    district_id: dominantValue(members.map((m) => m.district_id)),
    report_ids: members.map((m) => m.id),
    reports_count: members.length,
    status: deriveClusterStatus(members.map((m) => m.status_id)),
  };
};

// Rebuilds a cluster from its current members; removes it when none are left.
export const recomputeCluster = async (clusterId) => {
  const cluster = await ReportCluster.findById(clusterId).select("report_ids");
  if (!cluster) return null;

  const members = (await loadMembers(cluster.report_ids)).filter(
    (member) => member.point,
  );
  if (!members.length) {
    await ReportCluster.deleteOne({ _id: clusterId });
    return null;
  }

  Object.assign(cluster, buildClusterFields(members));
  await cluster.save();
  return cluster;
};

export const detachFromCluster = async (report) => {
  if (!report.cluster_id) return;
  const clusterId = report.cluster_id;
  await ReportCluster.updateOne(
    { _id: clusterId },
    { $pull: { report_ids: report._id } },
  );
  await Report.updateOne(
    { _id: report._id },
    { cluster_id: null },
    { timestamps: false },
  );
  report.cluster_id = null;
  await recomputeCluster(clusterId);
};

const findCandidates = ({ type_id, point, radiusM }) =>
  ReportCluster.find({
    type_id,
    status: "active",
    centroid: {
      $near: {
        $geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        $maxDistance: radiusM,
      },
    },
  })
    .select("+centroid_embedding")
    .limit(20);

// Puts a report into the best matching cluster or opens a new one. A report is
// first detached from its old cluster, so the same call also handles a changed
// type or location. Returns the cluster, or null when the report cannot be
// clustered yet (no coordinates, no vector, or cancelled).
//
// Known limit: two reports saved at the same moment can each open a cluster
// instead of sharing one; a later reassignment or the backfill merges them.
export const assignToCluster = async (reportId, params = {}) => {
  const { alpha, radiusM, tau } = { ...CLUSTER_DEFAULTS, ...params };

  const report = await Report.findById(reportId).select("+embedding");
  if (!report) return null;

  await detachFromCluster(report);

  const member = toMember(report);
  if (report.status_id === "cancelled" || !member.point || !member.embedding) {
    return null;
  }

  const candidates = await findCandidates({
    type_id: report.type_id,
    point: member.point,
    radiusM,
  });

  const options = await Promise.all(
    candidates.map(async (cluster) => ({
      cluster,
      point: {
        lat: cluster.centroid.coordinates[1],
        lng: cluster.centroid.coordinates[0],
      },
      embedding: cluster.centroid_embedding,
      members: await loadMembers(cluster.report_ids),
    })),
  );

  const picked = pickCluster(member, options, { alpha, radiusM, tau });
  if (picked) {
    const { cluster } = picked.cluster;
    Object.assign(cluster, buildClusterFields(picked.members));
    await cluster.save();
    await Report.updateOne(
      { _id: report._id },
      { cluster_id: cluster._id },
      { timestamps: false },
    );
    return cluster;
  }

  const created = await ReportCluster.create({
    ...buildClusterFields([member]),
    type_id: report.type_id,
  });
  await Report.updateOne(
    { _id: report._id },
    { cluster_id: created._id },
    { timestamps: false },
  );
  return created;
};

// Call after a status change: a cancelled report leaves its cluster, any other
// change only refreshes the cluster status.
export const syncClusterStatus = async (report) => {
  if (!report.cluster_id) return;
  if (report.status_id === "cancelled") {
    await detachFromCluster(report);
  } else {
    await recomputeCluster(report.cluster_id);
  }
};

// Background wrappers: a clustering failure must never break the request.
export const clusterReportSafely = async (reportId) => {
  try {
    await assignToCluster(reportId);
  } catch (error) {
    console.error("Clustering error:", error);
  }
};

export const syncClusterStatusSafely = async (report) => {
  try {
    await syncClusterStatus(report);
  } catch (error) {
    console.error("Cluster status error:", error);
  }
};
