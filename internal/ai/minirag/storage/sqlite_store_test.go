package storage

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func intPtr(i int) *int { return &i }

func setupTestStore(t *testing.T) *SQLiteStore {
	t.Helper()
	dbPath := t.TempDir() + "/test.db"
	store, err := NewSQLiteStore(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { store.Close() })
	return store
}

func TestAddAndGetChunk(t *testing.T) {
	store := setupTestStore(t)
	meta := ChunkMeta{
		ContractID:  1,
		ChunkIndex:  0,
		Content:     "Indemnización ilimitada...",
		PageNumber:  intPtr(5),
		ClauseType:  "indemnizacion",
		VectorID:    123,
	}
	err := store.AddChunk(meta)
	require.NoError(t, err)

	retrieved, err := store.GetChunkByVectorID(123)
	require.NoError(t, err)
	require.Equal(t, meta.Content, retrieved.Content)
	require.Equal(t, meta.ContractID, retrieved.ContractID)
	require.Equal(t, meta.ChunkIndex, retrieved.ChunkIndex)
	require.Equal(t, meta.ClauseType, retrieved.ClauseType)
	if meta.PageNumber != nil {
		require.NotNil(t, retrieved.PageNumber)
		require.Equal(t, *meta.PageNumber, *retrieved.PageNumber)
	} else {
		require.Nil(t, retrieved.PageNumber)
	}
	require.Equal(t, meta.VectorID, retrieved.VectorID)
}

func TestGetByContract(t *testing.T) {
	store := setupTestStore(t)
	// Add two chunks for same contract
	for i := 0; i < 2; i++ {
		store.AddChunk(ChunkMeta{
			ContractID: 99,
			ChunkIndex: i,
			Content:    "text " + string(rune('0'+i)),
			VectorID:   int64(100 + i),
		})
	}
	chunks, err := store.GetChunksByContract(99)
	require.NoError(t, err)
	require.Len(t, chunks, 2)
	// Ensure correct ordering by chunk_index
	require.Equal(t, 0, chunks[0].ChunkIndex)
	require.Equal(t, 1, chunks[1].ChunkIndex)
}

func TestSQLiteStore_Close(t *testing.T) {
	dbPath := t.TempDir() + "/test_close.db"
	store, err := NewSQLiteStore(dbPath)
	require.NoError(t, err)
	err = store.Close()
	require.NoError(t, err)
}

func TestChunkMeta_OptionalFields(t *testing.T) {
	// Test with nil page number and empty clause type
	store := setupTestStore(t)
	meta := ChunkMeta{
		ContractID:  2,
		ChunkIndex:  1,
		Content:     "simple content",
		PageNumber:  nil,
		ClauseType:  "",
		VectorID:    456,
	}
	err := store.AddChunk(meta)
	require.NoError(t, err)

	retrieved, err := store.GetChunkByVectorID(456)
	require.NoError(t, err)
	require.Nil(t, retrieved.PageNumber)
	require.Empty(t, retrieved.ClauseType)
}
