import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/Select.css";

const LIST_MAX_HEIGHT = 240;
const OPTION_HEIGHT = 40;

// Styled replacement for <select>. The list is rendered in a portal so that
// scrolling containers (the form body) never clip it.
// options: [{ value, label }]; onChange receives the option's value.
const Select = ({
  id,
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex(
    (option) => String(option.value) === String(value),
  );
  const selected = options[selectedIndex];

  const openList = () => {
    if (disabled || options.length === 0) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closeList = () => setOpen(false);

  const choose = (index) => {
    const option = options[index];
    if (option) onChange(option.value);
    closeList();
    triggerRef.current?.focus();
  };

  // Place the list under the trigger, or above it when there is no room.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const wanted = Math.min(
      LIST_MAX_HEIGHT,
      options.length * OPTION_HEIGHT + 8,
    );
    const openUp = spaceBelow < wanted && spaceAbove > spaceBelow;

    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      minWidth: rect.width,
      maxHeight: Math.min(LIST_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !listRef.current?.contains(event.target)
      ) {
        closeList();
      }
    };
    // A scroll elsewhere would leave the list floating in the wrong place.
    const onScroll = (event) => {
      if (!listRef.current?.contains(event.target)) closeList();
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", closeList);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", closeList);
    };
  }, [open]);

  useEffect(() => {
    if (open && position) {
      listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
    }
  }, [open, active, position]);

  const onKeyDown = (event) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList();
        break;
      default:
    }
  };

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`select-trigger${open ? " is-open" : ""}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "select-value" : "select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="select-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            className="select-list"
            style={position}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                className={`select-option${index === active ? " is-active" : ""}${index === selectedIndex ? " is-selected" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {index === selectedIndex && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
};

export default Select;
