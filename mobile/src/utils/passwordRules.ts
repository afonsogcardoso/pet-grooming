export type PasswordRuleResult = {
  key: string;
  label: string;
  satisfied: boolean;
};

const BASE_RULES: Array<{
  key: string;
  labelKey: string;
  test: (value: string) => boolean;
}> = [
  {
    key: "length",
    labelKey: "common.passwordRuleLength",
    test: (value) => value.length >= 8,
  },
  {
    key: "uppercase",
    labelKey: "common.passwordRuleUpper",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    labelKey: "common.passwordRuleLower",
    test: (value) => /[a-z]/.test(value),
  },
  {
    key: "number",
    labelKey: "common.passwordRuleNumber",
    test: (value) => /\d/.test(value),
  },
];

export function evaluatePasswordRules(
  password: string,
  translate: (key: string) => string
): PasswordRuleResult[] {
  return BASE_RULES.map((rule) => ({
    key: rule.key,
    label: translate(rule.labelKey),
    satisfied: rule.test(password),
  }));
}

export function isPasswordValid(password: string) {
  return BASE_RULES.every((rule) => rule.test(password));
}

