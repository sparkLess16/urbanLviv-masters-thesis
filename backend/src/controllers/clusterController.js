import mongoose from "mongoose";
import Report from "../models/Report.js";
import ReportCluster from "../models/ReportCluster.js";
import { parseClusterQuery } from "../utils/clusterQuery.js";
import { toClusterItem, toClusterReport } from "../utils/clusterView.js";

const MAX_CLUSTERS = 200;

// The report that names a cluster: the representative one, or the first member
// for clusters built before representatives were stored.
const namingReportId = (cluster) =>
  cluster.representative_report_id ?? cluster.report_ids[0];

// Titles of the naming reports and the number of reports in progress, each in
// one query for the whole page of clusters.
const loadListExtras = async (clusters) => {
  const representativeIds = clusters.map(namingReportId).filter(Boolean);
  const titles = new Map(
    (
      await Report.find({ _id: { $in: representativeIds } }).select("title")
    ).map((report) => [String(report._id), report.title]),
  );

  const progress = new Map(
    (
      await Report.aggregate([
        {
          $match: {
            cluster_id: { $in: clusters.map((cluster) => cluster._id) },
            status_id: "in_progress",
          },
        },
        { $group: { _id: "$cluster_id", count: { $sum: 1 } } },
      ])
    ).map((row) => [String(row._id), row.count]),
  );

  return { titles, progress };
};

// GET /api/clusters?district_id=&status=open|resolved|closed|all
export const getClusters = async (req, res) => {
  try {
    const { filter, error } = parseClusterQuery(req.query);
    if (error) return res.status(400).json({ message: error });

    const clusters = await ReportCluster.find(filter)
      .sort({ reports_count: -1, modified_dt: -1 })
      .limit(MAX_CLUSTERS);

    const { titles, progress } = await loadListExtras(clusters);
    res.json({
      items: clusters.map((cluster) =>
        toClusterItem(cluster, {
          title: titles.get(String(namingReportId(cluster))),
          inProgressCount: progress.get(String(cluster._id)),
        }),
      ),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/clusters/:id: the cluster with its member reports.
export const getClusterById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid cluster id" });
    }
    const cluster = await ReportCluster.findById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ message: "Cluster not found" });
    }

    const reports = await Report.find({
      _id: { $in: cluster.report_ids },
      status_id: { $ne: "cancelled" },
    })
      .select("title status_id type_id created_dt geo")
      .sort({ created_dt: 1 });

    const titles = new Map(
      reports.map((report) => [String(report._id), report.title]),
    );
    const inProgressCount = reports.filter(
      (report) => report.status_id === "in_progress",
    ).length;

    res.json({
      ...toClusterItem(cluster, {
        title: titles.get(String(namingReportId(cluster))) ?? reports[0]?.title,
        inProgressCount,
      }),
      reports: reports.map(toClusterReport).filter((item) => item.point),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
