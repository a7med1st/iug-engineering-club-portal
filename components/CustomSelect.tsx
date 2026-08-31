"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export type CustomSelectOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
};

type CustomSelectProps = {
  name: string;
  options: readonly CustomSelectOption[];
  placeholder: string;
  defaultValue?: string;
  value?: string;
  required?: boolean;
  icon?: LucideIcon;
  validationMessage?: string;
  onChange?: (value: string) => void;
};

export default function CustomSelect({
  name,
  options,
  placeholder,
  defaultValue = "",
  value: controlledValue,
  required = false,
  icon: TriggerIcon,
  validationMessage = `يرجى اختيار ${placeholder.replace(/^اختر\s*/, "")}`,
  onChange,
}: CustomSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showError, setShowError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const errorId = useId();
  const currentValue = controlledValue ?? internalValue;
  const selectedOption = options.find((option) => option.value === currentValue);
  const SelectedIcon = selectedOption?.icon ?? TriggerIcon;

  useEffect(() => {
    if (controlledValue === undefined) {
      setInternalValue(defaultValue);
    }
  }, [controlledValue, defaultValue]);

  useEffect(() => {
    const root = rootRef.current;
    const form = root?.closest("form");

    if (!form || controlledValue !== undefined) {
      return;
    }

    function handleReset() {
      setInternalValue(defaultValue);
      setShowError(false);
      setIsOpen(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [controlledValue, defaultValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === currentValue)
    );
    setActiveIndex(selectedIndex);

    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentValue, isOpen, options]);

  function updateValue(nextValue: string) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
    setShowError(false);
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openAt(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), options.length - 1));
    setIsOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const selectedIndex = options.findIndex(
        (option) => option.value === currentValue
      );
      openAt(
        selectedIndex >= 0
          ? selectedIndex
          : event.key === "ArrowUp"
            ? options.length - 1
            : 0
      );
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      updateValue(options[index].value);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (index + direction + options.length) % options.length;
      setActiveIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : options.length - 1;
      setActiveIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  function handleInvalid(event: FormEvent<HTMLSelectElement>) {
    event.preventDefault();
    setShowError(true);

    const form = rootRef.current?.closest("form");
    const firstInvalidSelect = form?.querySelector<HTMLSelectElement>(
      ".contact-custom-select-validation:invalid"
    );

    if (firstInvalidSelect !== event.currentTarget) {
      return;
    }

    setIsOpen(true);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div
      ref={rootRef}
      className={`contact-custom-select${isOpen ? " is-open" : ""}${
        showError ? " is-invalid" : ""
      }`}
    >
      <input type="hidden" name={name} value={currentValue} />

      <select
        className="contact-custom-select-validation"
        value={currentValue}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => undefined}
        onInvalid={handleInvalid}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        className="contact-custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="contact-custom-select-value">
          {SelectedIcon && (
            <SelectedIcon size={18} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span className={selectedOption ? "" : "is-placeholder"}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className="contact-custom-select-chevron"
          size={18}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </button>

      <div
        id={listboxId}
        className="contact-custom-select-menu"
        role="listbox"
        aria-label={placeholder}
        aria-hidden={!isOpen}
        aria-activedescendant={
          isOpen ? `${listboxId}-option-${activeIndex}` : undefined
        }
      >
        <div className="contact-custom-select-options">
          {options.map((option, index) => {
            const OptionIcon = option.icon;
            const selected = option.value === currentValue;

            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                id={`${listboxId}-option-${index}`}
                type="button"
                className="contact-custom-select-option"
                role="option"
                aria-selected={selected}
                tabIndex={isOpen && activeIndex === index ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => updateValue(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span className="contact-custom-select-option-copy">
                  {OptionIcon && (
                    <span className="contact-custom-select-option-icon">
                      <OptionIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  )}
                  <span>{option.label}</span>
                </span>
                <Check
                  className="contact-custom-select-check"
                  size={17}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      {showError && (
        <span id={errorId} className="contact-custom-select-error" role="alert">
          {validationMessage}
        </span>
      )}
    </div>
  );
}
