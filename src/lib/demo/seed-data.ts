export function demoId(number: number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

const names = [
  'Maya Chen',
  'Jordan Davis',
  'Sofia Rivera',
  'Alex Morgan',
  'Priya Shah',
  'Noah Wilson',
  'Amara Okafor',
  'Leo Martin',
  'Isabella Rossi',
  'Ethan Lee',
  'Ava Thompson',
  'Oliver Brown',
  'Zara Ahmed',
  'Lucas Garcia',
  'Emma Taylor',
  'Arjun Patel',
  'Chloe Kim',
  'Mateo Lopez',
  'Grace Walker',
  'Sam Anderson',
];

export function createSeedData(anchor = new Date()) {
  const midnight = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const at = (days: number, minutes = 0) =>
    new Date(midnight - days * 86_400_000 + minutes * 60_000).toISOString();
  const customers = names.map((name, i) => ({
    id: demoId(i + 1),
    name,
    email: `demo.${i + 1}@example.com`,
    is_demo: true,
    created_at: at(90),
  }));
  const payment_methods = customers.map((customer, i) => ({
    id: demoId(100 + i),
    customer_id: customer.id,
    type: 'card',
    brand: i % 2 === 0 ? 'visa' : 'mastercard',
    last4: String(4100 + i),
    created_at: at(90),
  }));
  const merchants = [
    'Little Oak Coffee',
    'Metro Books',
    'Green Market',
    'Cloudnote',
    'Daily Goods',
    'Harbor Outfitters',
  ];
  const transactions = Array.from({ length: 300 }, (_, i) => {
    const customerIndex = Math.floor(i / 15);
    return {
      id: demoId(1000 + i),
      customer_id: customers[customerIndex].id,
      payment_method_id: payment_methods[customerIndex].id,
      amount_cents: 500 + ((i * 7919) % 24500),
      currency: 'USD',
      status: 'succeeded' as 'succeeded' | 'declined' | 'pending',
      merchant: merchants[i % merchants.length],
      created_at: at(5 + (i % 35), 600 + (i % 100)),
      decline_code: null as string | null,
      idempotency_key: `demo-payment-${i + 1}`,
    };
  });
  for (const [index, minute] of [
    [0, 810],
    [1, 812],
  ]) {
    Object.assign(transactions[index], {
      amount_cents: 8499,
      merchant: 'Northstar Electronics',
      created_at: at(1, minute),
    });
  }
  Object.assign(transactions[15], {
    amount_cents: 12900,
    merchant: 'Harbor Outfitters',
    status: 'declined',
    decline_code: 'insufficient_funds',
    created_at: at(1, 900),
  });
  Object.assign(transactions[30], {
    amount_cents: 6500,
    merchant: 'Everyday Studio',
    created_at: at(8, 600),
  });
  Object.assign(transactions[45], {
    amount_cents: 4200,
    merchant: 'Metro Books',
    created_at: at(12, 600),
  });
  Object.assign(transactions[60], {
    status: 'declined',
    decline_code: 'expired_card',
    created_at: at(2, 500),
  });
  Object.assign(transactions[75], {
    status: 'declined',
    decline_code: 'do_not_honor',
    created_at: at(2, 500),
  });
  Object.assign(transactions[90], { status: 'pending', created_at: at(0, 500) });
  const refunds = [
    {
      id: demoId(2000),
      transaction_id: transactions[30].id,
      amount_cents: 6500,
      currency: 'USD',
      status: 'pending',
      reason: 'Customer return',
      idempotency_key: 'demo-refund-pending',
      created_at: at(2, 600),
      updated_at: at(2, 600),
    },
    {
      id: demoId(2001),
      transaction_id: transactions[45].id,
      amount_cents: 4200,
      currency: 'USD',
      status: 'succeeded',
      reason: 'Order cancelled',
      idempotency_key: 'demo-refund-completed',
      created_at: at(5, 600),
      updated_at: at(3, 600),
    },
  ];
  const refund_policies = [
    {
      id: demoId(3000),
      reason: 'duplicate_charge',
      description:
        'Investigate matching successful charges by merchant, amount, and time. Matching charges suggest a duplicate but do not prove one. A verified duplicate may be refunded after human approval.',
      window_days: 120,
      requires_approval: true,
    },
    {
      id: demoId(3001),
      reason: 'missing_refund',
      description:
        'A pending refund normally takes 5–10 business days to appear, depending on the bank. A succeeded refund has already been issued; do not recommend issuing it again. Escalate when the processing window has elapsed.',
      window_days: 10,
      requires_approval: true,
    },
    {
      id: demoId(3002),
      reason: 'declined_payment',
      description:
        'A declined payment did not settle and cannot be refunded. Explain the decline and suggest a safe next step. Any temporary authorization may take several business days to disappear.',
      window_days: 7,
      requires_approval: true,
    },
    {
      id: demoId(3003),
      reason: 'other',
      description:
        'Review the transaction and existing refunds first. Any proposed refund requires a human decision and cannot exceed the unrefunded successful charge.',
      window_days: 30,
      requires_approval: true,
    },
  ];
  return { customers, payment_methods, transactions, refunds, refund_policies };
}
