#!/usr/bin/env python3
"""
upload_books.py — bulk-load a book catalogue JSON file into Firestore.

Setup:
    pip install firebase-admin

    1. Firebase console → Project settings → Service accounts →
       "Generate new private key" → save as serviceAccountKey.json
       next to this script (never commit this file).
    2. Prepare a JSON file shaped like data/sample-books.json — a list of
       book objects with at least: BK_ID, bookName, author, year, genre.
    3. Run:
       python upload_books.py --file books.json

Behavior:
    - Skips (does not overwrite) any BK_ID that already exists in
      Firestore, so this is safe to re-run on a growing dataset.
    - Assigns Firestore's server timestamp as createdAt on insert.
    - Prints a summary of inserted / skipped / failed rows at the end.
"""

import argparse
import json
import sys

import firebase_admin
from firebase_admin import credentials, firestore


def load_books(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Expected the JSON file to contain a list of book objects.")
    return data


def main():
    parser = argparse.ArgumentParser(description="Upload a book catalogue JSON file into Firestore.")
    parser.add_argument("--file", required=True, help="Path to the books JSON file.")
    parser.add_argument("--key", default="serviceAccountKey.json", help="Path to the Firebase service account key.")
    args = parser.parse_args()

    cred = credentials.Certificate(args.key)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    books = load_books(args.file)
    books_ref = db.collection("books")

    inserted, skipped, failed = 0, 0, 0

    for book in books:
        bk_id = book.get("BK_ID")
        if not bk_id:
            print(f"  ✗ Skipping row with no BK_ID: {book.get('bookName', '?')}")
            failed += 1
            continue

        existing = books_ref.where("BK_ID", "==", bk_id).limit(1).get()
        if existing:
            print(f"  · Skipping {bk_id} — already exists.")
            skipped += 1
            continue

        try:
            book_with_meta = {**book, "createdAt": firestore.SERVER_TIMESTAMP}
            books_ref.add(book_with_meta)
            print(f"  ✓ Inserted {bk_id} — {book.get('bookName')}")
            inserted += 1
        except Exception as e:
            print(f"  ✗ Failed on {bk_id}: {e}")
            failed += 1

    print("\n---")
    print(f"Inserted: {inserted}  Skipped: {skipped}  Failed: {failed}")


if __name__ == "__main__":
    sys.exit(main())
