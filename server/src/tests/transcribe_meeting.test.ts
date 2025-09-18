import { describe, expect, it, beforeEach } from 'bun:test';
import { transcribeMeetingChunk, type TranscribeChunkInput } from '../handlers/transcribe_meeting';

// Helper function to create mock audio data
function createMockAudioChunk(size: number, avgValue: number = 128): Uint8Array {
  const chunk = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    // Add some variation around the average value
    const variation = Math.floor(Math.random() * 20) - 10;
    chunk[i] = Math.max(0, Math.min(255, avgValue + variation));
  }
  return chunk;
}

// Test inputs with different audio characteristics
const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';

describe('transcribeMeetingChunk', () => {
  beforeEach(() => {
    // Clear any existing sessions between tests
    // Note: In production, this would be handled by proper session cleanup
  });

  it('should process initial audio chunk and create new session', async () => {
    const input: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 75), // Medium audio level
      workspace_id: mockWorkspaceId
    };

    const result = await transcribeMeetingChunk(input);

    expect(result.session_id).toBeDefined();
    expect(typeof result.session_id).toBe('string');
    expect(result.session_id.length).toBeGreaterThan(0);
    expect(result.partial_transcript).toBeDefined();
    expect(typeof result.partial_transcript).toBe('string');
    expect(result.is_final).toBe(false);
  });

  it('should continue existing session with provided session_id', async () => {
    // First chunk
    const firstInput: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 100),
      workspace_id: mockWorkspaceId
    };

    const firstResult = await transcribeMeetingChunk(firstInput);
    const sessionId = firstResult.session_id;

    // Second chunk with same session
    const secondInput: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 120),
      workspace_id: mockWorkspaceId,
      session_id: sessionId
    };

    const secondResult = await transcribeMeetingChunk(secondInput);

    expect(secondResult.session_id).toBe(sessionId);
    expect(secondResult.partial_transcript.length).toBeGreaterThan(firstResult.partial_transcript.length);
    expect(secondResult.partial_transcript).toContain(firstResult.partial_transcript);
  });

  it('should handle ArrayBuffer input correctly', async () => {
    const uint8Array = createMockAudioChunk(1000, 80);
    const arrayBuffer = new ArrayBuffer(uint8Array.length);
    new Uint8Array(arrayBuffer).set(uint8Array);

    const input: TranscribeChunkInput = {
      audio_chunk: arrayBuffer,
      workspace_id: mockWorkspaceId
    };

    const result = await transcribeMeetingChunk(input);

    expect(result.session_id).toBeDefined();
    expect(result.partial_transcript).toBeDefined();
    expect(result.is_final).toBe(false);
  });

  it('should mark transcription as final after multiple chunks', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    let lastResult;

    // Process multiple chunks
    for (let i = 0; i < 6; i++) {
      const input: TranscribeChunkInput = {
        audio_chunk: createMockAudioChunk(1000, 100),
        workspace_id: mockWorkspaceId,
        session_id: sessionId
      };

      lastResult = await transcribeMeetingChunk(input);
    }

    expect(lastResult?.is_final).toBe(true);
    expect(lastResult?.partial_transcript.length).toBeGreaterThan(0);
  });

  it('should mark as final for silent audio (low values)', async () => {
    const input: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 5), // Very low audio levels
      workspace_id: mockWorkspaceId
    };

    const result = await transcribeMeetingChunk(input);

    expect(result.is_final).toBe(true);
  });

  it('should handle small audio chunks (silence)', async () => {
    const input: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(50, 128), // Small chunk
      workspace_id: mockWorkspaceId
    };

    const result = await transcribeMeetingChunk(input);

    // Should still create session but may have empty transcript
    expect(result.session_id).toBeDefined();
    expect(result.partial_transcript).toBe('');
    expect(result.is_final).toBe(false);
  });

  it('should generate different transcripts based on audio characteristics', async () => {
    const inputs = [
      { audio_chunk: createMockAudioChunk(1000, 30), workspace_id: mockWorkspaceId },  // Low
      { audio_chunk: createMockAudioChunk(1000, 80), workspace_id: mockWorkspaceId },  // Medium-low
      { audio_chunk: createMockAudioChunk(1000, 120), workspace_id: mockWorkspaceId }, // Medium-high
      { audio_chunk: createMockAudioChunk(1000, 200), workspace_id: mockWorkspaceId }  // High
    ];

    const results = await Promise.all(inputs.map(input => transcribeMeetingChunk(input)));

    // Should generate different transcripts
    const transcripts = results.map(r => r.partial_transcript);
    const uniqueTranscripts = new Set(transcripts);
    expect(uniqueTranscripts.size).toBeGreaterThan(1);
  });

  it('should reject empty audio chunk', async () => {
    const input: TranscribeChunkInput = {
      audio_chunk: new Uint8Array(0),
      workspace_id: mockWorkspaceId
    };

    expect(transcribeMeetingChunk(input)).rejects.toThrow(/audio chunk is required/i);
  });

  it('should reject missing workspace_id', async () => {
    const input: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 128),
      workspace_id: ''
    };

    expect(transcribeMeetingChunk(input)).rejects.toThrow(/workspace id is required/i);
  });

  it('should reject workspace_id mismatch for existing session', async () => {
    // Create session with first workspace
    const firstInput: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 128),
      workspace_id: mockWorkspaceId
    };

    const firstResult = await transcribeMeetingChunk(firstInput);
    
    // Try to use same session with different workspace
    const secondInput: TranscribeChunkInput = {
      audio_chunk: createMockAudioChunk(1000, 128),
      workspace_id: '999e9999-e99b-99d9-a999-999999999999',
      session_id: firstResult.session_id
    };

    expect(transcribeMeetingChunk(secondInput)).rejects.toThrow(/workspace_id mismatch/i);
  });

  it('should accumulate transcript text across multiple chunks', async () => {
    const sessionId = 'test-session-id';
    const chunks = [
      createMockAudioChunk(1000, 60),  // Should produce "Hello"
      createMockAudioChunk(1000, 90),  // Should produce "everyone"
      createMockAudioChunk(1000, 130)  // Should produce "to the meeting"
    ];

    let accumulatedText = '';
    
    for (const chunk of chunks) {
      const input: TranscribeChunkInput = {
        audio_chunk: chunk,
        workspace_id: mockWorkspaceId,
        session_id: sessionId
      };

      const result = await transcribeMeetingChunk(input);
      
      // Text should accumulate
      expect(result.partial_transcript.length).toBeGreaterThanOrEqual(accumulatedText.length);
      if (accumulatedText) {
        expect(result.partial_transcript).toContain(accumulatedText);
      }
      
      accumulatedText = result.partial_transcript;
    }

    // Final transcript should contain multiple words
    expect(accumulatedText.split(' ').length).toBeGreaterThan(1);
  });
});