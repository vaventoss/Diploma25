import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from scipy import stats

# Завантажуємо CSV
df = pd.read_csv("output_obj1.csv", delimiter=";")

# Параметри для аналізу
params = ["x_len", "y_len", "diagonal", "area", "percent"]

sns.set(style="whitegrid")

# --- Гістограми, Boxplot і KDE ---
for param in params:
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 3, 1)
    sns.histplot(data=df, x=param, hue="shapeType", kde=False, bins=20, palette="Set2")
    plt.title(f"Гістограма: {param}")

    plt.subplot(1, 3, 2)
    sns.boxplot(data=df, x="shapeType", y=param, palette="Set2")
    plt.title(f"Boxplot: {param}")

    plt.subplot(1, 3, 3)
    sns.kdeplot(data=df, x=param, hue="shapeType", fill=True, palette="Set2")
    plt.title(f"KDE: {param}")

    plt.tight_layout()
    plt.show()

# --- Pairplot ---
sns.pairplot(df[params + ["shapeType"]], hue="shapeType", palette="Set2")
plt.suptitle("Pairplot параметрів", y=1.02)
plt.show()

# --- Heatmap кореляцій ---
plt.figure(figsize=(8, 6))
corr = df[params].corr(method="pearson")
sns.heatmap(corr, annot=True, cmap="coolwarm", fmt=".2f")
plt.title("Кореляція параметрів (Пірсон)")
plt.show()

# --- Інтерпретація кореляцій ---
def interpret_corr(value):
    if abs(value) < 0.2:
        return "дуже слабка"
    elif abs(value) < 0.4:
        return "слабка"
    elif abs(value) < 0.6:
        return "середня"
    elif abs(value) < 0.8:
        return "сильна"
    else:
        return "дуже сильна"

print("\nІнтерпретація коефіцієнтів кореляції Пірсона:")
for col1 in params:
    for col2 in params:
        if col1 != col2:
            val = corr.loc[col1, col2]
            print(f"{col1} vs {col2}: {val:.2f} → {interpret_corr(val)}")

# --- Статистичний звіт по групах ---
report = df.groupby("shapeType")[params].agg(["mean", "std"])
print("\nСтатистичний звіт по групах (середнє і стандартне відхилення):")
print(report)

# --- Невизначеність вимірювань (95% довірчий інтервал) ---
confidence = 0.95
print("\nНевизначеність вимірювань (довірчий інтервал 95%):")

for shape in df["shapeType"].unique():
    print(f"\nОб'єкт: {shape}")
    subset = df[df["shapeType"] == shape]
    for param in params:
        values = subset[param].dropna()
        n = len(values)
        mean = np.mean(values)
        std = np.std(values, ddof=1)
        sem = std / np.sqrt(n)
        t_val = stats.t.ppf((1 + confidence) / 2, df=n-1)
        delta = t_val * sem
        print(f"{param}: середнє = {mean:.3f}, σ = {std:.3f}, SEM = {sem:.3f}, Δ = ±{delta:.3f}")
