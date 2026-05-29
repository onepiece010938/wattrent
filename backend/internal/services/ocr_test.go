package services

import "testing"

func TestDecodeBase64Image(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		wantErr  bool
		wantMIME string
		wantData []byte
	}{
		{
			name:     "raw base64 defaults to jpeg",
			input:    "SGVsbG8=", // "Hello"
			wantMIME: "image/jpeg",
			wantData: []byte("Hello"),
		},
		{
			name:     "data uri with png",
			input:    "data:image/png;base64,SGVsbG8=",
			wantMIME: "image/png",
			wantData: []byte("Hello"),
		},
		{
			name:     "data uri without semicolon",
			input:    "data:image/webp,SGVsbG8=",
			wantMIME: "image/webp",
			wantData: []byte("Hello"),
		},
		{name: "malformed data uri", input: "data:image/png;base64", wantErr: true},
		{name: "invalid base64", input: "not!valid!base64!!!", wantErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			data, mime, err := decodeBase64Image(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got mime=%q data=%v", mime, data)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if mime != tc.wantMIME {
				t.Errorf("mime = %q, want %q", mime, tc.wantMIME)
			}
			if string(data) != string(tc.wantData) {
				t.Errorf("data = %q, want %q", string(data), string(tc.wantData))
			}
		})
	}
}

func TestGuessMimeFromURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
		err   bool
	}{
		{input: "gs://bucket/foo.jpg", want: "image/jpeg"},
		{input: "gs://bucket/foo.JPEG", want: "image/jpeg"},
		{input: "gs://bucket/foo.png", want: "image/png"},
		{input: "gs://bucket/foo.webp", want: "image/webp"},
		{input: "gs://bucket/foo.heic", err: true},
		{input: "gs://bucket/foo", err: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()
			got, err := guessMimeFromURL(tc.input)
			if tc.err {
				if err == nil {
					t.Fatalf("expected error for %q, got %q", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}
