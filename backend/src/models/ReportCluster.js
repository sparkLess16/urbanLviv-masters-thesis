import mongoose from "mongoose";
import { FALLBACK_SERVICE } from "../config/responsibleServices.js";

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

    // Set from the type and district (FR-04); an admin can override it.
    responsible_service: {
      type: String,
      required: true,
      default: FALLBACK_SERVICE.name,
    },

    // True after an admin override: recomputing the cluster keeps the value.
    responsible_service_manual: {
      type: Boolean,
      default: false,
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
