import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SupportDialog from "./SupportDialog";
import SubmitDuplicateDialog from "./SubmitDuplicateDialog";
import { supportReport, updateSupport } from "../services/supportApi";

jest.mock("../services/supportApi", () => ({
  supportReport: jest.fn(),
  updateSupport: jest.fn(),
}));

// No point: the dialog shows no map (Leaflet is not needed in these tests).
const item = {
  reportId: "r1",
  title: "Pothole on Zelena Street",
  description: "Big pothole near house 15",
  type_id: "roads",
  distance_m: 30,
  created_dt: "2026-10-21T10:00:00Z",
  score: 0.95,
  match_percent: 95,
  point: null,
};

beforeEach(() => {
  supportReport.mockReset();
  updateSupport.mockReset();
});

test("support dialog sends the comment and where the support came from", async () => {
  supportReport.mockResolvedValue({ supported_by_count: 2 });
  const onSupported = jest.fn();
  render(
    <SupportDialog
      item={item}
      typeName="Roads"
      formPoint={null}
      onClose={() => {}}
      onSupported={onSupported}
    />,
  );

  fireEvent.change(screen.getByLabelText(/anything to add/i), {
    target: { value: "  it got bigger  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Support report" }));

  await waitFor(() => expect(onSupported).toHaveBeenCalled());
  expect(supportReport).toHaveBeenCalledWith("r1", {
    comment: "it got bigger",
    via: "hint",
    score: 0.95,
  });
});

test("support dialog shows the server's message and stays open", async () => {
  supportReport.mockRejectedValue({
    response: { data: { message: "You already support this report" } },
  });
  const onSupported = jest.fn();
  render(
    <SupportDialog
      item={item}
      typeName="Roads"
      formPoint={null}
      onClose={() => {}}
      onSupported={onSupported}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Support report" }));
  expect(
    await screen.findByText("You already support this report"),
  ).toBeInTheDocument();
  expect(onSupported).not.toHaveBeenCalled();
});

test("support dialog closes on Cancel and Escape", () => {
  const onClose = jest.fn();
  render(
    <SupportDialog
      item={item}
      typeName="Roads"
      formPoint={null}
      onClose={onClose}
      onSupported={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("submit dialog offers the three choices", () => {
  const handlers = {
    onSupport: jest.fn(),
    onSeparate: jest.fn(),
    onBack: jest.fn(),
  };
  render(<SubmitDuplicateDialog item={item} typeName="Roads" {...handlers} />);

  expect(screen.getByText("95% match")).toBeInTheDocument();
  expect(screen.getByText(/30 m from your point/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Support this report" }));
  fireEvent.click(
    screen.getByRole("button", { name: "No, submit as a separate report" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Back to editing" }));

  expect(handlers.onSupport).toHaveBeenCalledTimes(1);
  expect(handlers.onSeparate).toHaveBeenCalledTimes(1);
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
});

test("submit dialog disables the choices while supporting", () => {
  render(
    <SubmitDuplicateDialog
      item={item}
      typeName="Roads"
      busy
      error="Could not support"
      onSupport={() => {}}
      onSeparate={() => {}}
      onBack={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Supporting..." })).toBeDisabled();
  expect(screen.getByText("Could not support")).toBeInTheDocument();
});

test("edit mode starts with the saved comment and saves changes", async () => {
  updateSupport.mockResolvedValue({ supported_by_count: 2 });
  const onSupported = jest.fn();
  render(
    <SupportDialog
      mode="edit"
      item={item}
      typeName="Roads"
      initial={{ comment: "old comment", point: null }}
      onClose={() => {}}
      onSupported={onSupported}
      onStop={() => {}}
    />,
  );

  const field = screen.getByLabelText(/your comment/i);
  expect(field).toHaveValue("old comment");
  fireEvent.change(field, { target: { value: " new comment " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(onSupported).toHaveBeenCalled());
  expect(updateSupport).toHaveBeenCalledWith("r1", { comment: "new comment" });
  expect(supportReport).not.toHaveBeenCalled();
});

test("edit mode can clear the comment", async () => {
  updateSupport.mockResolvedValue({ supported_by_count: 2 });
  render(
    <SupportDialog
      mode="edit"
      item={item}
      typeName="Roads"
      initial={{ comment: "to remove", point: null }}
      onClose={() => {}}
      onSupported={() => {}}
      onStop={() => {}}
    />,
  );

  fireEvent.change(screen.getByLabelText(/your comment/i), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(updateSupport).toHaveBeenCalled());
  expect(updateSupport).toHaveBeenCalledWith("r1", { comment: "" });
});

test("edit mode offers to stop supporting", () => {
  const onStop = jest.fn();
  render(
    <SupportDialog
      mode="edit"
      item={item}
      typeName="Roads"
      initial={{ comment: "", point: null }}
      onClose={() => {}}
      onSupported={() => {}}
      onStop={onStop}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Stop supporting this report" }),
  );
  expect(onStop).toHaveBeenCalledTimes(1);
});

test("create mode has no stop button", () => {
  render(
    <SupportDialog
      item={item}
      typeName="Roads"
      formPoint={null}
      onClose={() => {}}
      onSupported={() => {}}
      onStop={() => {}}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /stop supporting/i }),
  ).not.toBeInTheDocument();
});
