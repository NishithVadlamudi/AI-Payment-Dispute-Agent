const codes: Record<string, { meaning: string; suggested_action: string }> = {
  insufficient_funds: {
    meaning: 'The issuing bank declined the payment because available funds were insufficient.',
    suggested_action:
      'Check available funds or use another payment method. Do not repeatedly retry the same payment.',
  },
  expired_card: {
    meaning: 'The card used for this payment has expired.',
    suggested_action: 'Update the card details or use a valid payment method.',
  },
  do_not_honor: {
    meaning: 'The issuing bank declined the payment without a specific reason.',
    suggested_action:
      'Contact the issuing bank or use another payment method. The merchant cannot override this decision.',
  },
  incorrect_cvc: {
    meaning: 'The card security code could not be verified.',
    suggested_action:
      'Check the card details through the merchant’s secure checkout. Never share a full card number or security code in this chat.',
  },
  processing_error: {
    meaning: 'A processing problem prevented the payment from completing.',
    suggested_action: 'Check for a successful charge before retrying to avoid a duplicate payment.',
  },
};

export function explainDecline(code: string) {
  const explanation = Object.hasOwn(codes, code) ? codes[code] : undefined;
  return explanation
    ? { code, known: true, ...explanation }
    : {
        code,
        known: false,
        meaning: 'This decline code is not in the demo reference.',
        suggested_action:
          'Contact the issuing bank for clarification. Do not assume that funds were captured.',
      };
}
