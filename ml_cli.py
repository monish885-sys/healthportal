#!/usr/bin/env python3
"""JSON stdin/stdout CLI for symptom analysis (invoked by Node ML service)."""

import json
import os
import sys
from datetime import datetime

import pandas as pd

from symptom_analyzer import analyze_symptoms_api, get_disease_info, get_symptoms_api

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DP_PATH = os.path.join(SCRIPT_DIR, "dataset", "dp.csv")


def enrich_with_precautions(result):
    if not result.get("success") or result.get("severity") != "low":
        return result

    if not os.path.exists(DP_PATH):
        result["precautions"] = []
        result["medicine"] = ""
        return result

    try:
        dp_df = pd.read_csv(DP_PATH)
        predicted = str(result.get("predictedDisease", "")).strip()
        match = dp_df[dp_df["Disease"].str.strip().str.lower() == predicted.lower()]
        if match.empty:
            match = dp_df[dp_df["Disease"].str.contains(predicted, case=False, na=False)]
        if match.empty:
            result["precautions"] = []
            result["medicine"] = ""
            return result

        row = match.iloc[0]
        precautions = [
            str(row.get("Precaution_1", "") or ""),
            str(row.get("Precaution_2", "") or ""),
            str(row.get("Precaution_3", "") or ""),
            str(row.get("Precaution_4", "") or ""),
        ]
        result["precautions"] = [p for p in precautions if p]
        result["medicine"] = str(row.get("Medicine", "") or "")
    except Exception:
        result["precautions"] = []
        result["medicine"] = ""

    return result


def consultation_buddy(symptoms, patient_id, doctor_id):
    analysis_result = analyze_symptoms_api(symptoms)
    disease_info = None
    predicted_disease = analysis_result.get("predictedDisease", "")

    if os.path.exists(DP_PATH) and predicted_disease:
        dp_df = pd.read_csv(DP_PATH)
        disease_match = dp_df[dp_df["Disease"].str.lower() == predicted_disease.lower()]
        if disease_match.empty:
            disease_match = dp_df[dp_df["Disease"].str.contains(predicted_disease, case=False, na=False)]
        if not disease_match.empty:
            disease_info = disease_match.iloc[0].to_dict()

    return {
        "success": True,
        "patientId": patient_id,
        "doctorId": doctor_id,
        "symptoms": symptoms,
        "analysis": analysis_result,
        "precautions": {
            "disease": predicted_disease,
            "precaution1": disease_info.get("Precaution_1", "") if disease_info else "",
            "precaution2": disease_info.get("Precaution_2", "") if disease_info else "",
            "precaution3": disease_info.get("Precaution_3", "") if disease_info else "",
            "precaution4": disease_info.get("Precaution_4", "") if disease_info else "",
            "medicine": disease_info.get("Medicine", "") if disease_info else "",
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"success": False, "error": f"Invalid JSON input: {exc}"}))
        sys.exit(1)

    command = payload.get("command")
    try:
        if command == "analyze":
            result = analyze_symptoms_api(payload.get("symptoms", []))
            if payload.get("enrichPrecautions"):
                result = enrich_with_precautions(result)
            print(json.dumps(result))
            return

        if command == "symptoms":
            symptoms = get_symptoms_api() or []
            print(json.dumps(symptoms))
            return

        if command == "disease_info":
            print(json.dumps(get_disease_info(payload.get("diseaseName", ""))))
            return

        if command == "consultation_buddy":
            print(json.dumps(consultation_buddy(
                payload.get("symptoms", []),
                payload.get("patientId"),
                payload.get("doctorId"),
            )))
            return

        print(json.dumps({"success": False, "error": f"Unknown command: {command}"}))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
