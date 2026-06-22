"""
Train all symptom prediction models, generate training curves (loss/accuracy over epochs),
confusion matrices, and ROC curves. Saves plots to outputs/ and models to Models/.
"""
import os
import sys
import pickle
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    roc_curve,
    auc,
    RocCurveDisplay,
)
from sklearn.preprocessing import label_binarize
import warnings
warnings.filterwarnings('ignore')

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "ds.csv")
MODEL_PATH = os.path.join(SCRIPT_DIR, "Models")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "outputs")
os.makedirs(OUTPUT_PATH, exist_ok=True)
os.makedirs(MODEL_PATH, exist_ok=True)

TRAIN_TEST_SIZE = 0.2
RANDOM_STATE = 42
MLP_EPOCHS = 100
N_ESTIMATORS_MAX = 150  # for RF/GB learning curves


def load_and_prepare_data():
    """Load dataset and return X_train, X_test, y_train, y_test, vectorizer, classes."""
    df = pd.read_csv(DATASET_PATH, encoding="ISO-8859-1")
    symptom_cols = [c for c in df.columns if c.lower().startswith("symptom")]
    df[symptom_cols] = df[symptom_cols].fillna("")
    df["All_Symptoms"] = df[symptom_cols].apply(lambda row: " ".join(row.values.astype(str)), axis=1)
    X = df["All_Symptoms"]
    y = df["Disease"]
    classes = sorted(y.unique())
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TRAIN_TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    vectorizer = TfidfVectorizer()
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    return X_train_vec, X_test_vec, y_train, y_test, vectorizer, classes


def plot_mlp_training_curves(X_train, X_test, y_train, y_test, output_path):
    """
    Train MLP with warm_start and record loss + accuracy per epoch.
    Saves loss_over_epochs.png and accuracy_over_epochs.png.
    """
    print("Training MLPClassifier and recording loss/accuracy per epoch...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        max_iter=1,
        warm_start=True,
        random_state=RANDOM_STATE,
        early_stopping=False,
    )
    loss_history = []
    train_acc_history = []
    test_acc_history = []
    n_epochs = MLP_EPOCHS

    for epoch in range(1, n_epochs + 1):
        mlp.fit(X_train, y_train)
        if hasattr(mlp, 'loss_curve_') and len(mlp.loss_curve_) > 0:
            loss_history.append(float(mlp.loss_curve_[-1]))
        else:
            loss_history.append(float(mlp.loss_) if hasattr(mlp, 'loss_') else 0)
        train_acc = accuracy_score(y_train, mlp.predict(X_train))
        test_acc = accuracy_score(y_test, mlp.predict(X_test))
        train_acc_history.append(train_acc)
        test_acc_history.append(test_acc)
        if epoch % 10 == 0:
            print(f"  Epoch {epoch}: loss={loss_history[-1]:.4f}, train_acc={train_acc:.4f}, test_acc={test_acc:.4f}")

    epochs_range = range(1, len(loss_history) + 1)

    # Loss over epochs
    plt.figure(figsize=(8, 5))
    plt.plot(epochs_range, loss_history, 'b-', linewidth=2)
    plt.xlabel('Epoch', fontsize=12)
    plt.ylabel('Loss', fontsize=12)
    plt.title('MLPClassifier: Training Loss over Epochs', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(output_path, 'loss_over_epochs.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved {os.path.join(output_path, 'loss_over_epochs.png')}")

    # Accuracy over epochs
    plt.figure(figsize=(8, 5))
    plt.plot(epochs_range, train_acc_history, 'b-', label='Train accuracy', linewidth=2)
    plt.plot(epochs_range, test_acc_history, 'r-', label='Test accuracy', linewidth=2)
    plt.xlabel('Epoch', fontsize=12)
    plt.ylabel('Accuracy', fontsize=12)
    plt.title('MLPClassifier: Accuracy over Epochs', fontsize=14)
    plt.legend(loc='lower right', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(output_path, 'accuracy_over_epochs.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved {os.path.join(output_path, 'accuracy_over_epochs.png')}")

    return mlp


def plot_accuracy_vs_estimators(X_train, X_test, y_train, y_test, output_path):
    """
    Plot test accuracy vs n_estimators for RandomForest and GradientBoosting.
    """
    step = 10
    n_estimators_range = list(range(step, N_ESTIMATORS_MAX + 1, step))
    rf_acc, gb_acc = [], []

    print("Recording accuracy vs n_estimators for RandomForest...")
    for n in n_estimators_range:
        rf = RandomForestClassifier(n_estimators=n, random_state=RANDOM_STATE, n_jobs=-1)
        rf.fit(X_train, y_train)
        rf_acc.append(accuracy_score(y_test, rf.predict(X_test)))
    print("Recording accuracy vs n_estimators for GradientBoosting...")
    for n in n_estimators_range:
        gb = GradientBoostingClassifier(n_estimators=n, random_state=RANDOM_STATE)
        gb.fit(X_train, y_train)
        gb_acc.append(accuracy_score(y_test, gb.predict(X_test)))

    plt.figure(figsize=(9, 5))
    plt.plot(n_estimators_range, rf_acc, 'b-o', label='RandomForest', markersize=4)
    plt.plot(n_estimators_range, gb_acc, 'r-s', label='GradientBoosting', markersize=4)
    plt.xlabel('Number of estimators (trees)', fontsize=12)
    plt.ylabel('Test accuracy', fontsize=12)
    plt.title('Model accuracy vs number of estimators', fontsize=14)
    plt.legend(loc='lower right', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(output_path, 'accuracy_vs_estimators.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved {os.path.join(output_path, 'accuracy_vs_estimators.png')}")


def plot_confusion_matrix(cm, class_names, model_name, output_path):
    """Plot and save confusion matrix for a model."""
    plt.figure(figsize=(14, 12))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title(f'Confusion matrix: {model_name}', fontsize=14)
    plt.colorbar()
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=90, fontsize=7)
    plt.yticks(tick_marks, class_names, fontsize=7)
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     ha="center", va="center",
                     color="white" if cm[i, j] > thresh else "black", fontsize=5)
    plt.ylabel('True label', fontsize=12)
    plt.xlabel('Predicted label', fontsize=12)
    plt.tight_layout()
    safe_name = model_name.replace(' ', '_').replace('/', '_')
    plt.savefig(os.path.join(output_path, f'confusion_matrix_{safe_name}.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved confusion_matrix_{safe_name}.png")


def plot_roc_multiclass(y_test, y_proba, model_classes, classes, model_name, output_path):
    """
    Plot ROC curves for multiclass (one curve per class, one-vs-rest).
    model_classes: order of columns in y_proba (model.classes_).
    classes: sorted list of all class names for consistent labeling.
    """
    n_classes = len(classes)
    y_test_bin = label_binarize(y_test, classes=classes)
    # Align y_proba columns to same order as classes
    proba_ordered = np.zeros((y_proba.shape[0], n_classes))
    for i, c in enumerate(classes):
        if c in model_classes:
            j = list(model_classes).index(c)
            proba_ordered[:, i] = y_proba[:, j]
    y_proba = proba_ordered

    plt.figure(figsize=(10, 8))
    for i in range(n_classes):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_proba[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, lw=2, label=f'{classes[i][:20]} (AUC = {roc_auc:.2f})')

    plt.plot([0, 1], [0, 1], 'k--', lw=2)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate', fontsize=12)
    plt.ylabel('True Positive Rate', fontsize=12)
    plt.title(f'ROC curves (One-vs-Rest): {model_name}', fontsize=14)
    plt.legend(loc='lower right', fontsize=6, ncol=2)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    safe_name = model_name.replace(' ', '_').replace('/', '_')
    plt.savefig(os.path.join(output_path, f'roc_curve_{safe_name}.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved roc_curve_{safe_name}.png")


def get_models():
    """Return dict of name -> model instance (for training from scratch)."""
    return {
        'MultinomialNB': MultinomialNB(),
        'LogisticRegression': LogisticRegression(max_iter=500, random_state=RANDOM_STATE, n_jobs=-1),
        'RandomForest': RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1),
        'GradientBoosting': GradientBoostingClassifier(n_estimators=100, random_state=RANDOM_STATE),
        'SVC': SVC(kernel='linear', probability=True, random_state=RANDOM_STATE),
        'KNeighbors': KNeighborsClassifier(n_neighbors=5),
        'MLPClassifier': None,  # trained separately with curves
    }


def main():
    print("Loading data...")
    X_train, X_test, y_train, y_test, vectorizer, classes = load_and_prepare_data()
    print(f"Train size: {X_train.shape[0]}, Test size: {X_test.shape[0]}, Classes: {len(classes)}")

    # --- Training curves: MLP loss/accuracy over epochs ---
    mlp = plot_mlp_training_curves(X_train, X_test, y_train, y_test, OUTPUT_PATH)

    # --- Accuracy vs n_estimators for RF and GB ---
    plot_accuracy_vs_estimators(X_train, X_test, y_train, y_test, OUTPUT_PATH)

    # --- Train all models (except MLP already trained) ---
    models = get_models()
    models['MLPClassifier'] = mlp

    # Add Ensemble (Voting) after training base models
    nb = MultinomialNB()
    lr = LogisticRegression(max_iter=500, random_state=RANDOM_STATE, n_jobs=-1)
    rf = RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1)
    gb = GradientBoostingClassifier(n_estimators=100, random_state=RANDOM_STATE)
    nb.fit(X_train, y_train)
    lr.fit(X_train, y_train)
    rf.fit(X_train, y_train)
    gb.fit(X_train, y_train)
    ensemble = VotingClassifier(
        estimators=[('NaiveBayes', nb), ('LogisticRegression', lr), ('RandomForest', rf), ('GradientBoosting', gb)],
        voting='soft'
    )
    ensemble.fit(X_train, y_train)
    models['Ensemble'] = ensemble
    # Keep refs for saving
    models['MultinomialNB'] = nb
    models['LogisticRegression'] = lr
    models['RandomForest'] = rf
    models['GradientBoosting'] = gb

    # Train SVC and KNN
    print("Training SVC...")
    models['SVC'].fit(X_train, y_train)
    print("Training KNeighbors...")
    models['KNeighbors'].fit(X_train, y_train)

    # --- Confusion matrices and ROC for each model ---
    for name, model in models.items():
        if model is None:
            continue
        print(f"Evaluating {name}...")
        y_pred = model.predict(X_test)
        cm = confusion_matrix(y_test, y_pred, labels=classes)
        plot_confusion_matrix(cm, classes, name, OUTPUT_PATH)
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X_test)
            model_classes = model.classes_
            plot_roc_multiclass(y_test, y_proba, model_classes, classes, name, OUTPUT_PATH)
        else:
            print(f"  (No predict_proba for {name}, skipping ROC)")

    # --- Save enhanced models and vectorizer (compatible with symptom_analyzer) ---
    enhanced_models = {k: v for k, v in models.items() if v is not None}
    with open(os.path.join(MODEL_PATH, "enhanced_symptom_model.pkl"), 'wb') as f:
        pickle.dump(enhanced_models, f)
    with open(os.path.join(MODEL_PATH, "enhanced_vectorizer.pkl"), 'wb') as f:
        pickle.dump(vectorizer, f)
    print(f"\nSaved enhanced models and vectorizer to {MODEL_PATH}")

    # --- Summary: accuracy table ---
    print("\n--- Model accuracy (test set) ---")
    for name, model in models.items():
        if model is not None:
            acc = accuracy_score(y_test, model.predict(X_test))
            print(f"  {name}: {acc:.4f}")
    print(f"\nAll plots saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
