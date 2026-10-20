import { ChevronDown, UserRound } from 'lucide-react';
import type { Customer } from '@/lib/db/schemas';

export function CustomerPicker({
  customers,
  value,
  onChange,
  disabled,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="customer-picker">
      <label htmlFor="customer">DEMO CUSTOMER</label>
      <div className="select-wrap">
        <UserRound size={17} aria-hidden="true" />
        <select
          id="customer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {!customers.length && <option value="">No demo customers loaded</option>}
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="select-arrow" aria-hidden="true" />
      </div>
      <p>A separate account. A fresh investigation.</p>
    </div>
  );
}
