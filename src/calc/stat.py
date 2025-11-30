import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Загружаем CSV
df = pd.read_csv("output_obj1.csv", delimiter=";")

# Список параметров для анализа
params = ["x_len", "y_len", "diagonal", "area", "percent"]

sns.set(style="whitegrid")

# --- Гистограммы, Boxplot и KDE для каждого параметра ---
for param in params:
    plt.figure(figsize=(12, 4))

    # Гистограмма
    plt.subplot(1, 3, 1)
    sns.histplot(data=df, x=param, hue="shapeType", kde=False, bins=20, palette="Set2")
    plt.title(f"Гистограмма: {param}")

    # Boxplot
    plt.subplot(1, 3, 2)
    sns.boxplot(data=df, x="shapeType", y=param, palette="Set2")
    plt.title(f"Boxplot: {param}")

    # KDE
    plt.subplot(1, 3, 3)
    sns.kdeplot(data=df, x=param, hue="shapeType", fill=True, palette="Set2")
    plt.title(f"KDE: {param}")

    plt.tight_layout()
    plt.show()

# --- Pairplot ---
sns.pairplot(df[params + ["shapeType"]], hue="shapeType", palette="Set2")
plt.suptitle("Pairplot параметров", y=1.02)
plt.show()

# --- Heatmap корреляций ---
plt.figure(figsize=(8, 6))
corr = df[params].corr(method="pearson")
sns.heatmap(corr, annot=True, cmap="coolwarm", fmt=".2f")
plt.title("Корреляция параметров (Пирсон)")
plt.show()

# --- Интерпретация коэффициентов корреляции ---
def interpret_corr(value):
    if abs(value) < 0.2:
        return "очень слабая связь"
    elif abs(value) < 0.4:
        return "слабая связь"
    elif abs(value) < 0.6:
        return "средняя связь"
    elif abs(value) < 0.8:
        return "сильная связь"
    else:
        return "очень сильная связь"

print("\nИнтерпретация коэффициентов корреляции Пирсона:")
for col1 in params:
    for col2 in params:
        if col1 != col2:
            val = corr.loc[col1, col2]
            print(f"{col1} vs {col2}: {val:.2f} → {interpret_corr(val)}")

# --- Статистический отчёт по группам ---
report = df.groupby("shapeType")[params].agg(["mean", "std"])
print("\nСтатистический отчёт по группам (среднее и стандартное отклонение):")
print(report)

# --- Пример t-теста Стьюдента для area ---
circular = df[df["shapeType"] == "circular"]["area"]
rectangular = df[df["shapeType"] == "rectangular"]["area"]

t_stat, p_value = stats.ttest_ind(circular, rectangular, equal_var=False)
print("\nT-тест Стьюдента для параметра area:")
print("Среднее circular:", circular.mean())
print("Среднее rectangular:", rectangular.mean())
print("t-статистика:", t_stat)
print("p-значение:", p_value)
if p_value < 0.05:
    print("Разница статистически значима (p < 0.05)")
else:
    print("Разница незначима (p >= 0.05)")
