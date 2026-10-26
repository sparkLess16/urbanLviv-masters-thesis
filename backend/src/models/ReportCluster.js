import mongoose from "mongoose";

const reportClusterSchema = new mongoose.Schema(
  {
    // GeoJSON Point, coordinates are [lng, lat]: mean position of the members.
    centroid: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },

    // Unit mean vector of the members. Hidden like the report embedding.
    centroid_embedding: {
      type: [Number],
      select: false,
      default: undefined,
    },

    // Most frequent district among the members.
    district_id: {
      type: String,
      required: true,
    },

    // A cluster holds one type only.
    type_id: {
      type: String,
      required: true,
    },

    report_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],

    reports_count: {
      type: Number,
      default: 0,
    },

    // Filled by the responsible-service step (FR-04).
    responsible_service: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "resolved", "closed"],
      default: "active",
    },
  },
  {
    timestamps: {
      createdAt: "created_dt",
      updatedAt: "modified_dt",
    },
    toJSON: {
      transform: (doc, ret) => {
        delete ret.centroid_embedding;
        return ret;
      },
    },
  },
);

reportClusterSchema.index({ centroid: "2dsphere" });
reportClusterSchema.index({ type_id: 1, status: 1 });

export default mongoose.model("ReportCluster", reportClusterSchema);
