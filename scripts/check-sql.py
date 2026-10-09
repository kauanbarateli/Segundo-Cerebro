"""Parse PostgreSQL files without opening a database or executing SQL.

Checks outer SQL plus SQL/PLpgSQL function bodies and DO blocks. It cannot
resolve database objects, permissions, types, runtime behavior or dynamic SQL.
"""

import argparse
from pathlib import Path

from pglast import ast, parse_plpgsql, parse_sql
from pglast.stream import RawStream


def validate(path: Path) -> tuple[int, int, int]:
    statements = parse_sql(path.read_text(encoding="utf-8-sig"))
    functions = blocks = 0
    for raw in statements:
        statement = raw.stmt
        if isinstance(statement, ast.DoStmt):
            parse_plpgsql(RawStream()(statement))
            blocks += 1
        elif isinstance(statement, ast.CreateFunctionStmt):
            options = {option.defname: option.arg for option in statement.options}
            language = options["language"].sval
            name = ".".join(part.sval for part in statement.funcname)
            try:
                if language == "plpgsql":
                    parse_plpgsql(RawStream()(statement))
                elif language == "sql":
                    parse_sql(options["as"][0].sval)
                else:
                    raise ValueError(f"Unsupported function language: {language}")
            except Exception as error:
                raise ValueError(f"Function {name}: {error}") from error
            functions += 1
    return len(statements), functions, blocks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    files = args.files or sorted((root / "supabase").rglob("*.sql"))
    if not files:
        parser.error("No SQL files found")
    errors = 0
    for path in files:
        try:
            statements, functions, blocks = validate(path)
            print(f"OK {path.name}: {statements} statements, {functions} functions, {blocks} DO blocks")
        except Exception as error:
            errors += 1
            print(f"ERROR {path.name}: {error}")
    print(f"Static syntax only: {len(files)} files, {errors} errors. No SQL executed.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
