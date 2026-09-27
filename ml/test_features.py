import unittest,json,joblib
from pathlib import Path
import numpy as np
from features import transform,FEATURES
class FeaturesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base=Path(__file__).parent
        cls.bundle=joblib.load(base/'model.joblib');cls.sample=json.loads((base/'replay.json').read_text())[0]['inputs']
    def test_replay_has_exact_training_feature_order(self):
        X=transform([self.sample],self.bundle['metadata'])
        self.assertEqual(list(X.columns),FEATURES)
        self.assertTrue(np.isfinite(X.to_numpy()).all())
        p=self.bundle['model'].predict_proba(X)[0,1]
        self.assertGreaterEqual(p,0);self.assertLessEqual(p,1)
    def test_unknown_cell_rejected(self):
        with self.assertRaises(ValueError):transform([{**self.sample,'connected_cell':'not-a-training-cell'}],self.bundle['metadata'])
    def test_nonfinite_telemetry_rejected(self):
        with self.assertRaises(ValueError):transform([{**self.sample,'signal_strength':float('nan')}],self.bundle['metadata'])
    def test_zero_sinr_stays_finite(self):
        self.assertTrue(np.isfinite(transform([{**self.sample,'sinr':0}],self.bundle['metadata']).to_numpy()).all())
if __name__=='__main__':unittest.main()
