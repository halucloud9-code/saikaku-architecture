const MEMBER_ALIAS_RE = /^M(?:10|[1-9])$/u;
const MEMBER_TOKEN_RE = /(^|[^0-9A-Za-z])(M(?:10|[1-9]))(?=[^0-9A-Za-z]|$)/gu;

function aliasOf(member) {
  return typeof member === 'string' ? member : member?.alias;
}

function labelsByAlias(members, memberLabels) {
  return new Map(members.flatMap((member, index) => {
    const alias = aliasOf(member);
    const label = typeof memberLabels[index] === 'string' ? memberLabels[index].trim() : '';
    return MEMBER_ALIAS_RE.test(alias) && label ? [[alias, label]] : [];
  }));
}

export function memberNameForAlias(alias, members = [], memberLabels = []) {
  if (!MEMBER_ALIAS_RE.test(alias)) return alias;
  return labelsByAlias(members, memberLabels).get(alias) || alias;
}

export function replaceMemberAliases(value, members = [], memberLabels = []) {
  if (typeof value !== 'string' || !value) return value;
  const names = labelsByAlias(members, memberLabels);
  if (names.size === 0) return value;
  return value.replace(MEMBER_TOKEN_RE, (token, prefix, alias) => `${prefix}${names.get(alias) || alias}`);
}
