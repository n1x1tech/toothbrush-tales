import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import type { Story } from '../hooks/useStoryGeneration'
import styles from './HistoryPage.module.css'

export default function HistoryPage() {
  const navigate = useNavigate()
  const { storyHistory, favoriteIds, toggleFavorite, clearHistory } = useAppStore()

  const handlePlayStory = (story: Story) => {
    navigate('/story', { state: { story } })
  }

  const favorites = storyHistory.filter((s) => favoriteIds.has(s.id))
  const recent = storyHistory.filter((s) => !favoriteIds.has(s.id))

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Story History</h1>

      {favorites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{'\u2B50'} Favorites</h2>
          <div className={styles.storyList}>
            {favorites.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                isFavorite={true}
                onPlay={() => handlePlayStory(story)}
                onToggleFavorite={() => toggleFavorite(story.id)}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{'\uD83D\uDCDA'} Recent Stories</h2>
          <div className={styles.storyList}>
            {recent.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                isFavorite={false}
                onPlay={() => handlePlayStory(story)}
                onToggleFavorite={() => toggleFavorite(story.id)}
              />
            ))}
          </div>
        </section>
      )}

      {storyHistory.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>{'\uD83D\uDCD6'}</span>
          <p>No stories yet!</p>
          <p className={styles.emptyHint}>Create your first story to see it here.</p>
          <button className={styles.createButton} onClick={() => navigate('/')}>
            Create a Story
          </button>
        </div>
      )}

      {storyHistory.length > 0 && (
        <button className={styles.clearButton} onClick={clearHistory}>
          Clear History
        </button>
      )}
    </div>
  )
}

interface StoryCardProps {
  story: Story
  isFavorite: boolean
  onPlay: () => void
  onToggleFavorite: () => void
}

function StoryCard({ story, isFavorite, onPlay, onToggleFavorite }: StoryCardProps) {
  return (
    <div className={styles.storyCard}>
      <div className={styles.cardContent} onClick={onPlay}>
        <div className={styles.cardHeader}>
          <span className={styles.characterName}>{story.characterName}</span>
          <button
            className={styles.favoriteBtn}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
          >
            {isFavorite ? '\u2B50' : '\u2606'}
          </button>
        </div>
        <p className={styles.theme}>{story.theme}</p>
        <p className={styles.preview}>{story.intro.slice(0, 80)}...</p>
      </div>
      <button className={styles.playButton} onClick={onPlay}>
        {'\u25B6\uFE0F'} Play
      </button>
    </div>
  )
}
