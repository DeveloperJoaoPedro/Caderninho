import {
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { ZodError } from "zod";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Notebook, SpinnerGap } from "@phosphor-icons/react";
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Notebook size={25} weight="bold" />
      </span>
      Caderninho<span className="logo-dot">.</span>
    </span>
  );
}
export function Button({
  children,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button {...props} className={`button ${variant} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p className="error-box" role="alert">
      {message}
    </p>
  ) : null;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Notebook size={38} weight="duotone" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-describedby"?: string;
            }>,
            {
              id: fieldId,
              "aria-describedby": hint ? fieldId + "-hint" : undefined,
            },
          )
        : children}
      {hint && <small id={fieldId + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description ?? "Preencha os campos abaixo."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Fechar">
              <X size={24} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function AsyncForm({
  children,
  onSubmit,
  submit = "Salvar",
  secondary,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void>;
  submit?: string;
  secondary?: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function handle(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await onSubmit();
    } catch (err) {
      setError(
        err instanceof ZodError
          ? err.issues[0].message
          : err instanceof Error
            ? err.message
            : "Confira os dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={handle} className="form-stack">
      <fieldset disabled={busy}>{children}</fieldset>
      <ErrorBox message={error} />
      <div className="form-footer">
        {secondary}
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <SpinnerGap className="spin" size={20} />
              Salvando…
            </>
          ) : (
            submit
          )}
        </Button>
      </div>
    </form>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={20} weight="bold" />
      {children}
    </Button>
  );
}
export function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PAID: "Paga",
    OVERDUE: "Atrasada",
    TODAY: "Vence hoje",
    PENDING: "A vencer",
    CANCELLED: "Cancelada",
  };
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {labels[status] ?? status}
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
