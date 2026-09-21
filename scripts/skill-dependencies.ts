// Kept free of third-party imports: skill-sync runs on hosts with Node and no installed packages.
export function resolveDependencyClosure(skills: { has(name: string): boolean }, dependencies: Readonly<Record<string, readonly string[]>>, requested: readonly string[]): string[] {
  const resolved = new Set<string>();
  const visit = (name: string): void => {
    if (!skills.has(name)) throw new Error(`unknown skill: ${name}`);
    if (resolved.has(name)) return;
    resolved.add(name);
    for (const dependency of [...(dependencies[name] ?? [])].sort((left, right) => left.localeCompare(right))) visit(dependency);
  };

  for (const name of [...requested].sort((left, right) => left.localeCompare(right))) visit(name);
  return [...resolved].sort((left, right) => left.localeCompare(right));
}
