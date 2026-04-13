"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/system/primitives";

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (typeof option === "string") return { value: option, label: option };
    return {
      value: option?.value ?? "",
      label: option?.label ?? String(option?.value ?? ""),
      description: option?.description || "",
    };
  });
}

export function SelectField({
  value,
  onChange,
  options = [],
  placeholder = "Choose an option",
  disabled = false,
  className = "",
}) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selectedOption = normalizedOptions.find((option) => String(option.value) === String(value)) || null;

  useEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      if (!buttonRef.current || typeof window === "undefined") return;
      const rect = buttonRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(320, normalizedOptions.length * 58 + 18);
      const spaceBelow = window.innerHeight - rect.bottom - 16;
      const shouldOpenUp = spaceBelow < Math.min(estimatedHeight, 180) && rect.top > spaceBelow;
      const width = Math.min(Math.max(rect.width, 240), 360);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      const top = shouldOpenUp
        ? Math.max(12, rect.top - Math.min(estimatedHeight, rect.top - 20) - 8)
        : rect.bottom + 8;
      const maxHeight = shouldOpenUp
        ? Math.max(140, rect.top - 20)
        : Math.max(140, window.innerHeight - rect.bottom - 20);

      setPosition({
        top,
        left,
        width,
        maxHeight: Math.min(320, maxHeight),
      });
    }

    function handlePointer(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, normalizedOptions.length]);

  function handleSelect(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className={`v2-select-root ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className={`v2-select-trigger ${open ? "v2-select-trigger-open" : ""} ${!selectedOption ? "v2-select-trigger-placeholder" : ""}`.trim()}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span className="v2-select-trigger-copy">
          <span className="v2-select-trigger-value">{selectedOption?.label || placeholder}</span>
          {selectedOption?.description ? <small>{selectedOption.description}</small> : null}
        </span>
        <Icon name="chevron-down" />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              className="v2-select-menu"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
              }}
            >
              {normalizedOptions.map((option) => {
                const selected = String(option.value) === String(value);
                return (
                  <button
                    key={`${listboxId}-${option.value}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`v2-select-option ${selected ? "v2-select-option-active" : ""}`.trim()}
                    onClick={() => handleSelect(option.value)}
                  >
                    <strong>{option.label}</strong>
                    {option.description ? <small>{option.description}</small> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
