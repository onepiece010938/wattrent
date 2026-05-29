package services

import (
	"strings"
	"testing"
)

func TestImageExt(t *testing.T) {
	t.Parallel()

	cases := map[string]struct {
		want string
		ok   bool
	}{
		"image/jpeg":         {want: "jpg", ok: true},
		"image/jpg":          {want: "jpg", ok: true},
		"image/png":          {want: "png", ok: true},
		"image/webp":         {want: "webp", ok: true},
		"image/heic":         {ok: false},
		"application/pdf":    {ok: false},
		"":                   {ok: false},
		"image/jpeg; q=high": {ok: false}, // parameters not stripped on purpose
	}

	for input, tc := range cases {
		input, tc := input, tc
		t.Run(input, func(t *testing.T) {
			t.Parallel()
			got, ok := imageExt(input)
			if ok != tc.ok {
				t.Fatalf("imageExt(%q) ok=%v, want %v", input, ok, tc.ok)
			}
			if got != tc.want {
				t.Errorf("imageExt(%q) = %q, want %q", input, got, tc.want)
			}
		})
	}
}

func TestParseGCSPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		gcsPath        string
		expectedBucket string
		wantBucket     string
		wantObject     string
		wantErrSub     string
	}{
		{
			name: "valid path", gcsPath: "gs://wattrent/users/u1/bills/b1.jpg",
			expectedBucket: "wattrent", wantBucket: "wattrent", wantObject: "users/u1/bills/b1.jpg",
		},
		{
			name: "any bucket accepted when expected blank", gcsPath: "gs://other/foo.png",
			expectedBucket: "", wantBucket: "other", wantObject: "foo.png",
		},
		{
			name: "bucket mismatch", gcsPath: "gs://wrong/foo.png",
			expectedBucket: "wattrent", wantErrSub: "bucket mismatch",
		},
		{name: "no prefix", gcsPath: "wattrent/foo.png", expectedBucket: "wattrent", wantErrSub: "invalid"},
		{name: "missing object", gcsPath: "gs://wattrent/", expectedBucket: "wattrent", wantErrSub: "invalid"},
		{name: "empty", gcsPath: "", expectedBucket: "wattrent", wantErrSub: "invalid"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			bucket, object, err := parseGCSPath(tc.gcsPath, tc.expectedBucket)
			if tc.wantErrSub != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got bucket=%q object=%q", tc.wantErrSub, bucket, object)
				}
				if !strings.Contains(err.Error(), tc.wantErrSub) {
					t.Fatalf("error %q does not contain %q", err.Error(), tc.wantErrSub)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if bucket != tc.wantBucket {
				t.Errorf("bucket = %q, want %q", bucket, tc.wantBucket)
			}
			if object != tc.wantObject {
				t.Errorf("object = %q, want %q", object, tc.wantObject)
			}
		})
	}
}
