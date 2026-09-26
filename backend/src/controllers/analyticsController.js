import Report from "../models/Report.js";

export const getAnalyticsOverview = async (req, res) => {
  try {
    const reports = await Report.find();

    const totalReports = reports.length;

    const resolvedReports = reports.filter(
      (report) => report.status_id === "resolved",
    ).length;

    const activeReports = reports.filter((report) =>
      ["new", "in_progress"].includes(report.status_id),
    ).length;

    const criticalReports = reports.filter(
      (report) =>
        ["high", "critical"].includes(report.priority_id) &&
        ["new", "in_progress"].includes(report.status_id),
    ).length;

    const resolvedWithDates = reports.filter(
      (report) =>
        report.status_id === "resolved" &&
        report.created_dt &&
        report.modified_dt,
    );

    const avgResolutionTimeDays =
      resolvedWithDates.length > 0
        ? resolvedWithDates.reduce((sum, report) => {
            const created = new Date(report.created_dt);
            const resolved = new Date(report.modified_dt);
            const diffDays = (resolved - created) / (1000 * 60 * 60 * 24);

            return sum + diffDays;
          }, 0) / resolvedWithDates.length
        : 0;

    res.json({
      totalReports,
      resolvedReports,
      avgResolutionTimeDays: Number(avgResolutionTimeDays.toFixed(1)),
      activeReports,
      criticalReports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
