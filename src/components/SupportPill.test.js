import { render, screen } from "@testing-library/react";
import SupportPill from "./SupportPill";

test("shows the short form in lists", () => {
  render(<SupportPill count={3} />);
  expect(screen.getByText("Supported by 3")).toBeInTheDocument();
});

test("shows people on the report page, singular for one", () => {
  const { rerender } = render(<SupportPill count={3} long />);
  expect(screen.getByText("Supported by 3 people")).toBeInTheDocument();
  rerender(<SupportPill count={1} long />);
  expect(screen.getByText("Supported by 1 person")).toBeInTheDocument();
});

test("renders nothing when nobody supports the report", () => {
  const { container } = render(<SupportPill count={0} />);
  expect(container).toBeEmptyDOMElement();
});
