#!/usr/bin/env python3
"""Plane project initializer — creates standard modules, labels, and cycles.

Usage:
    python3 ~/.agents/skills/plane-api/init_project.py [--modules-only] [--labels-only] [--cycles-only] [--dry-run] [--cycles=N]

Reads PLANE_TOKEN and PLANE_PROJECT from supported Plane config sources.
Idempotent: skips items that already exist (matched by name, case-insensitive).
"""
import sys
import urllib.error
from dataclasses import dataclass
from datetime import date, timedelta

from plane_client import PlaneConfigError, load_plane_client


MODULES = [
    {"name": "Config / VPS", "description": "Configuration serveur, infrastructure VPS, environnements"},
    {"name": "Deploy Project", "description": "Déploiement du projet, CI/CD, mise en production"},
    {"name": "Mise à jour du projet", "description": "Mises à jour techniques, dépendances, migrations"},
    {"name": "Design de la maquette", "description": "Conception UI/UX, maquettes, prototypes"},
    {"name": "Intégration du design", "description": "Intégration des maquettes, développement frontend"},
    {"name": "Testing / Livraison", "description": "Tests, QA, recette, livraison client"},
]

LABELS = [
    {"name": "feat", "color": "#4caf50"},
    {"name": "fix", "color": "#f44336"},
    {"name": "config", "color": "#9c27b0"},
    {"name": "frontend", "color": "#2196f3"},
    {"name": "backend", "color": "#ff9800"},
    {"name": "urgent", "color": "#d32f2f"},
    {"name": "blocker", "color": "#b71c1c"},
]


@dataclass(frozen=True)
class InitOptions:
    modules_only: bool = False
    labels_only: bool = False
    cycles_only: bool = False
    dry_run: bool = False
    num_cycles: int = 4

    def should_run(self, section):
        only_flags = {
            "modules": self.modules_only,
            "labels": self.labels_only,
            "cycles": self.cycles_only,
        }
        has_only_flag = any(only_flags.values())
        return only_flags[section] if has_only_flag else True


MONTH_NAMES_FR = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


def generate_cycles(count=4):
    """Generate weekly cycles starting from next Monday.

    Each cycle is named {Month}-S{week_number_in_month}.
    Example: Février-S3, Février-S4, Mars-S1, Mars-S2
    """
    today = date.today()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        start = today
    else:
        start = today + timedelta(days=days_until_monday)

    cycles = []
    for i in range(count):
        cycle_start = start + timedelta(weeks=i)
        cycle_end = cycle_start + timedelta(days=6)
        week_in_month = (cycle_start.day - 1) // 7 + 1
        month_name = MONTH_NAMES_FR[cycle_start.month]
        name = f"{month_name}-S{week_in_month}"
        cycles.append({
            "name": name,
            "start_date": cycle_start.isoformat(),
            "end_date": cycle_end.isoformat(),
        })
    return cycles


def parse_options(args):
    num_cycles = 4
    for arg in args:
        if not arg.startswith("--cycles="):
            continue
        try:
            num_cycles = int(arg.split("=", 1)[1])
        except ValueError:
            pass

    return InitOptions(
        modules_only="--modules-only" in args,
        labels_only="--labels-only" in args,
        cycles_only="--cycles-only" in args,
        dry_run="--dry-run" in args,
        num_cycles=num_cycles,
    )


class ProjectInitializer:
    """Creates the default Plane project resources idempotently."""

    def __init__(self, client, options):
        self.client = client
        self.options = options
        self.project_path = client.project.path
        self.results = []

    def run(self):
        if self.options.should_run("modules"):
            self.seed_named_resources("Module", f"{self.project_path}/modules/", MODULES)
        if self.options.should_run("labels"):
            self.seed_named_resources("Label", f"{self.project_path}/labels/", LABELS)
        if self.options.should_run("cycles"):
            self.seed_cycles()
        return self.results

    def seed_named_resources(self, resource_type, path, items):
        existing_names = self.existing_names(path)
        for item in items:
            self.create_if_missing(resource_type, item["name"], path, item, existing_names)

    def seed_cycles(self):
        path = f"{self.project_path}/cycles/"
        existing_names = self.existing_names(path)
        user_id = None

        for cycle in generate_cycles(self.options.num_cycles):
            detail = f"{cycle['start_date']} → {cycle['end_date']}"
            display_name = f"{cycle['name']} ({detail})"
            if cycle["name"].lower() in existing_names:
                self.results.append(("Cycle", display_name, "○ exists"))
                continue
            if self.options.dry_run:
                self.results.append(("Cycle", display_name, "~ dry-run"))
                continue
            if user_id is None:
                user_id = self.current_user_id()
            payload = {
                **cycle,
                "owned_by": user_id,
                "project_id": self.client.project.project_id,
            }
            self.try_create("Cycle", display_name, path, payload)

    def create_if_missing(self, resource_type, name, path, payload, existing_names):
        if name.lower() in existing_names:
            self.results.append((resource_type, name, "○ exists"))
            return
        if self.options.dry_run:
            self.results.append((resource_type, name, "~ dry-run"))
            return
        self.try_create(resource_type, name, path, payload)

    def existing_names(self, path):
        return {item["name"].lower() for item in self.client.results(path)}

    def current_user_id(self):
        return self.client.request("GET", "/users/me/")["id"]

    def try_create(self, resource_type, name, path, payload):
        try:
            self.client.request("POST", path, payload)
            self.results.append((resource_type, name, "✓ created"))
        except urllib.error.HTTPError as error:
            self.results.append((resource_type, name, f"✗ {error.code}"))


def print_summary(results):
    type_w = max(len(row[0]) for row in results) if results else 6
    name_w = max(len(row[1]) for row in results) if results else 10
    print(f"\n{'Type':<{type_w}}  {'Name':<{name_w}}  Status")
    print(f"{'-'*type_w}  {'-'*name_w}  {'-'*12}")
    for resource_type, name, status in results:
        print(f"{resource_type:<{type_w}}  {name:<{name_w}}  {status}")

    created = sum(1 for _, _, status in results if "created" in status)
    skipped = sum(1 for _, _, status in results if "exists" in status)
    failed = sum(1 for _, _, status in results if status.startswith("✗"))
    print(f"\n{created} created, {skipped} already existed, {failed} failed")


def main():
    try:
        options = parse_options(sys.argv[1:])
        client = load_plane_client()
        results = ProjectInitializer(client, options).run()
        print_summary(results)
    except PlaneConfigError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
