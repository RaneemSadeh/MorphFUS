import argparse
import os
import pickle

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from data_loader import load_flowmeter_dataset, prepare_flowmeter_features


DEFAULT_DATA_DIR = os.path.join("Data", "01", "Flowmeter")
DEFAULT_MODEL_PATH = os.path.join("models", "flowmeter_fault_model.pkl")


def main():
    parser = argparse.ArgumentParser(description="Train a flowmeter fault classifier on the real dataset.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to the flowmeter CSV dataset directory")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of data to hold out for testing")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed for train/test split")
    parser.add_argument("--output-model", default=DEFAULT_MODEL_PATH, help="File path to save the trained model")
    args = parser.parse_args()

    df = load_flowmeter_dataset(args.data_dir)
    X, y, feature_names = prepare_flowmeter_features(df)

    if X.size == 0:
        raise ValueError("No numeric features were found in the flowmeter dataset.")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="mean")),
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(max_iter=1000, solver="liblinear")),
    ])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"Training samples: {X_train.shape[0]}")
    print(f"Test samples: {X_test.shape[0]}")
    print(f"Accuracy: {accuracy:.4f}\n")
    print(classification_report(y_test, y_pred, digits=4))

    os.makedirs(os.path.dirname(args.output_model), exist_ok=True)
    with open(args.output_model, "wb") as f:
        pickle.dump({"model": pipeline, "feature_names": feature_names}, f)

    print(f"Saved trained model to {args.output_model}")


if __name__ == "__main__":
    main()
