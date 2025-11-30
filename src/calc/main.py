import json
import csv
from collections import defaultdict

def json_to_csv_by_object(json_file, output_prefix="output"):
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    grouped = defaultdict(list)
    for entry in data:
        grouped[entry["objectName"]].append(entry)

    for obj_name, records in grouped.items():
        filename = f"{output_prefix}_{obj_name}.csv"
        headers = records[0].keys()

        with open(filename, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers, delimiter=";")
            writer.writeheader()
            writer.writerows(records)

        print(f"Сохранено {len(records)} записей в {filename}")


json_to_csv_by_object("measurements.json")
