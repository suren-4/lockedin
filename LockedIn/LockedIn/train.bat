@echo off
python --version
pip install -r ml\requirements.txt
python ml\data_pipeline.py
python ml\train_model.py
