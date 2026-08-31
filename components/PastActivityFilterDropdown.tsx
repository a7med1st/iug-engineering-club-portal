"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BrainCircuit,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  CircuitBoard,
  Cog,
  DraftingCompass,
  Factory,
  GraduationCap,
  HardHat,
  Laptop,
  Layers3,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type PastActivityFilterOption = {
  value: string;
  label: string;
  slug?: string;
};

type PastActivityFilterDropdownProps = {
  name: string;
  label: string;
  defaultValue: string;
  options: PastActivityFilterOption[];
  kind: "department" | "year";
};

const departmentIcons: Record<string, LucideIcon> = {
  "computer-engineering": Laptop,
  "ai-engineering": BrainCircuit,
  architecture: DraftingCompass,
  "civil-engineering": HardHat,
  "industrial-engineering": Factory,
  "mechanical-engineering": Cog,
  "electrical-engineering": Zap,
  "intelligent-systems": CircuitBoard,
  "smart-systems-engineering": CircuitBoard,
};

function optionIcon(
  option: PastActivityFilterOption,
  kind: PastActivityFilterDropdownProps["kind"],
) {
  if (kind === "year") {
    return option.value ? CalendarDays : CalendarRange;
  }

  if (!option.value) return Layers3;
  return departmentIcons[option.slug ?? ""] ?? GraduationCap;
}

export default function PastActivityFilterDropdown({
  name,
  label,
  defaultValue,
  options,
  kind,
}: PastActivityFilterDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = useMemo(() => {
    const index = options.findIndex((option) => option.value === value);
    return index >= 0 ? index : 0;
  }, [options, value]);
  const selected = options[selectedIndex];
  const SelectedIcon = optionIcon(selected, kind);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;

    setActiveIndex(selectedIndex);
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedIndex]);

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;

      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function focusOption(index: number) {
    const nextIndex = (index + options.length) % options.length;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function selectOption(index: number) {
    setValue(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    setActiveIndex(
      event.key === "ArrowDown"
        ? selectedIndex
        : Math.max(0, selectedIndex),
    );
    setOpen(true);
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(index);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div
      ref={rootRef}
      className={`past-filter-dropdown ${open ? "is-open" : ""}`}
      data-kind={kind}
    >
      <input type="hidden" name={name} value={value} />

      <button
        ref={triggerRef}
        type="button"
        className="past-filter-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="past-filter-dropdown-value">
          <span className="past-filter-dropdown-icon" aria-hidden="true">
            <SelectedIcon size={17} strokeWidth={2.2} />
          </span>
          <span>{selected.label}</span>
        </span>

        <ChevronDown
          className="past-filter-dropdown-chevron"
          size={18}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          className="past-filter-dropdown-menu"
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            const OptionIcon = optionIcon(option, kind);

            return (
              <button
                key={option.value || `all-${kind}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={active}
                tabIndex={index === activeIndex ? 0 : -1}
                className={`past-filter-dropdown-option ${
                  active ? "is-selected" : ""
                }`}
                onClick={() => selectOption(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span className="past-filter-dropdown-option-icon" aria-hidden="true">
                  <OptionIcon size={17} strokeWidth={2.2} />
                </span>
                <span className="past-filter-dropdown-option-label">
                  {option.label}
                </span>
                <span className="past-filter-dropdown-check" aria-hidden="true">
                  {active ? <Check size={15} strokeWidth={2.8} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
