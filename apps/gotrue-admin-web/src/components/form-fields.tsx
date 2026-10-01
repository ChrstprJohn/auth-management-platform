import type { UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';

export function TextField({
  id,
  label,
  registration,
  error,
  type = 'text',
  autoComplete,
  description,
  disabled,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: string;
  autoComplete?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${id}-help ${id}-error`}
        {...registration}
      />
      <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
export function PasswordField({
  id,
  label,
  registration,
  error,
  visible,
  toggle,
  newPassword = false,
  disabled,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  visible: boolean;
  toggle: () => void;
  newPassword?: boolean;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={`${id}-help ${id}-error`}
          {...registration}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            aria-label={
              visible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            aria-pressed={visible}
            onClick={toggle}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id={`${id}-help`}>
        {newPassword
          ? 'At least 8 characters; at most 72 UTF-8 bytes.'
          : 'Use your existing operator password.'}
      </FieldDescription>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
