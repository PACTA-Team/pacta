package ai

import "testing"

func TestRateLimiter_Allow(t *testing.T) {
	rl := NewRateLimiter(2)

	rem1, ok := rl.Allow(1)
	if !ok || rem1 != 1 {
		t.Fatalf("first allow failed: rem=%d ok=%v", rem1, ok)
	}

	rem2, ok := rl.Allow(1)
	if !ok || rem2 != 0 {
		t.Fatalf("second allow failed: rem=%d ok=%v", rem2, ok)
	}

	rem3, ok := rl.Allow(1)
	if ok || rem3 != 0 {
		t.Fatalf("third should be denied: ok=%v rem=%d", ok, rem3)
	}
}
