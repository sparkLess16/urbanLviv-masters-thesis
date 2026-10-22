import { render, screen, fireEvent } from "@testing-library/react";
import Select from "./Select";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

const setup = (value = "") => {
  const onChange = jest.fn();
  render(
    <Select
      id="s"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Pick one"
    />,
  );
  return { onChange, trigger: screen.getByRole("combobox") };
};

test("shows the placeholder, then the selected label", () => {
  const { trigger } = setup();
  expect(trigger).toHaveTextContent("Pick one");
});

test("shows the label of the current value", () => {
  const { trigger } = setup("b");
  expect(trigger).toHaveTextContent("Beta");
});

test("opens on click and picks an option with the mouse", () => {
  const { onChange, trigger } = setup();
  fireEvent.click(trigger);
  expect(screen.getAllByRole("option")).toHaveLength(3);

  fireEvent.click(screen.getByRole("option", { name: "Gamma" }));
  expect(onChange).toHaveBeenCalledWith("c");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("keyboard: arrows move, Enter selects", () => {
  const { onChange, trigger } = setup("a");
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith("b");
});

test("Escape closes the list without changing the value", () => {
  const { onChange, trigger } = setup("a");
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
