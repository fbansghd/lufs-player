import { useState, useRef, useEffect } from 'react'
import { open } from '@tauri-apps/api/dialog'
import { readBinaryFile, readDir } from '@tauri-apps/api/fs'
import { appDataDir } from '@tauri-apps/api/path'
import { createDir, writeTextFile, readTextFile } from '@tauri-apps/api/fs'
import useLUFSNormalizer from '../../hooks/useLUFSNormalizer'
import styles from './Player.module.scss'

export default function Player() {
  const [songs, setSongs] = useState([])
  const [currentIndex, setCurrentIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRandom, setIsRandom] = useState(true)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [normalizeTarget, setNormalizeTarget] = useState(-14)
  const [shuffledOrder, setShuffledOrder] = useState([])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [contextMenu, setContextMenu] = useState(null)

  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const normalizeGainRef = useRef(null)
  const masterGainRef = useRef(null)
  const audioBufferRef = useRef(null)
  const startTimeRef = useRef(0)
  const pausedAtRef = useRef(0)
  const animationFrameRef = useRef(null)
  const currentIndexRef = useRef(null)

  const { calculateLUFS, calculateGain } = useLUFSNormalizer()

  // プレイリストの保存
  const savePlaylist = async (playlistData) => {
    try {
      const appDir = await appDataDir()
      await createDir(appDir, { recursive: true })
      const playlistPath = `${appDir}playlists.json`
      await writeTextFile(playlistPath, JSON.stringify(playlistData, null, 2))
    } catch (error) {
      console.error('プレイリストの保存に失敗:', error)
    }
  }

  // プレイリストの読み込み
  const loadPlaylist = async () => {
    try {
      const appDir = await appDataDir()
      const playlistPath = `${appDir}playlists.json`
      const content = await readTextFile(playlistPath)
      const data = JSON.parse(content)
      setSongs(data.songs || [])
      setIsRandom(data.settings?.randomPlay ?? true)
      setMasterVolume(data.settings?.masterVolume ?? 0.8)
      setNormalizeTarget(data.settings?.normalizeTarget ?? -14)
    } catch (error) {
      console.log('プレイリストが見つかりません。新規作成します。')
    }
  }

  // シャッフル生成
  const generateShuffledOrder = (songList) => {
    const indices = songList.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices
  }

  // ファイル追加
  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Audio',
          extensions: ['mp3']
        }]
      })

      if (!selected) return

      const files = Array.isArray(selected) ? selected : [selected]
      const newSongs = []

      for (const filePath of files) {
        const fileData = await readBinaryFile(filePath)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const arrayBuffer = fileData.buffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        const lufs = calculateLUFS(audioBuffer)
        const gain = calculateGain(lufs, normalizeTarget)

        newSongs.push({
          id: `${Date.now()}-${Math.random()}`,
          path: filePath,
          name: filePath.split(/[\\/]/).pop(),
          duration: audioBuffer.duration,
          lufs,
          gain
        })

        audioContext.close()
      }

      const updatedSongs = [...songs, ...newSongs]
      setSongs(updatedSongs)
      
      await savePlaylist({
        settings: { randomPlay: isRandom, masterVolume, normalizeTarget },
        songs: updatedSongs
      })
    } catch (error) {
      console.error('ファイルの追加に失敗:', error)
    }
  }

  // フォルダー追加
  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true
      })

      if (!selected) return

      const entries = await readDir(selected, { recursive: true })
      const mp3Files = []

      const collectMp3 = (items) => {
        for (const item of items) {
          if (item.children) {
            collectMp3(item.children)
          } else if (item.path.toLowerCase().endsWith('.mp3')) {
            mp3Files.push(item.path)
          }
        }
      }
      collectMp3(entries)

      if (mp3Files.length === 0) return

      const newSongs = []
      for (const filePath of mp3Files) {
        const fileData = await readBinaryFile(filePath)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const arrayBuffer = fileData.buffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const lufs = calculateLUFS(audioBuffer)
        const gain = calculateGain(lufs, normalizeTarget)

        newSongs.push({
          id: `${Date.now()}-${Math.random()}`,
          path: filePath,
          name: filePath.split(/[\\/]/).pop(),
          duration: audioBuffer.duration,
          lufs,
          gain
        })

        audioContext.close()
      }

      const updatedSongs = [...songs, ...newSongs]
      setSongs(updatedSongs)

      await savePlaylist({
        settings: { randomPlay: isRandom, masterVolume, normalizeTarget },
        songs: updatedSongs
      })
    } catch (error) {
      console.error('フォルダーの追加に失敗:', error)
    }
  }

  // 削除
  const handleDelete = async (songId) => {
    const newSongs = songs.filter(s => s.id !== songId)
    setSongs(newSongs)
    
    if (currentIndex !== null && songs[currentIndex]?.id === songId) {
      stopPlayback()
      setCurrentIndex(null)
      currentIndexRef.current = null
    }

    await savePlaylist({
      settings: { randomPlay: isRandom, masterVolume, normalizeTarget },
      songs: newSongs
    })
    
    setContextMenu(null)
  }

  // 再生停止（resetPosition: trueで再生位置もリセット）
  const stopPlayback = (resetPosition = true) => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null
      sourceNodeRef.current.stop()
      sourceNodeRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setIsPlaying(false)
    if (resetPosition) {
      setCurrentTime(0)
      pausedAtRef.current = 0
    }
  }

  // 曲の再生
  const playSong = async (index) => {
    try {
      const startOffset = pausedAtRef.current  // stopPlayback前に保存
      stopPlayback(false)  // 位置リセットしない

      const song = songs[index]
      if (!song) return

      // AudioContextの初期化
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        normalizeGainRef.current = audioContextRef.current.createGain()
        masterGainRef.current = audioContextRef.current.createGain()

        normalizeGainRef.current.connect(masterGainRef.current)
        masterGainRef.current.connect(audioContextRef.current.destination)
      }

      // AudioContextがsuspended状態なら再開
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      // ファイル読み込み
      const fileData = await readBinaryFile(song.path)
      const arrayBuffer = fileData.buffer
      audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer)

      // ノード作成
      sourceNodeRef.current = audioContextRef.current.createBufferSource()
      sourceNodeRef.current.buffer = audioBufferRef.current
      
      // ゲイン設定
      normalizeGainRef.current.gain.value = song.gain
      masterGainRef.current.gain.value = masterVolume

      sourceNodeRef.current.connect(normalizeGainRef.current)
      
      // 再生
      const songDuration = audioBufferRef.current.duration
      sourceNodeRef.current.start(0, startOffset)
      pausedAtRef.current = 0  // 再生開始後にリセット
      startTimeRef.current = performance.now()
      setDuration(songDuration)
      setCurrentTime(startOffset)
      setIsPlaying(true)
      setCurrentIndex(index)
      currentIndexRef.current = index

      // 時間更新（現在のファイルの長さベース）
      const updateTime = () => {
        if (!sourceNodeRef.current) return
        const elapsed = startOffset + (performance.now() - startTimeRef.current) / 1000
        if (elapsed < songDuration) {
          setCurrentTime(elapsed)
          animationFrameRef.current = requestAnimationFrame(updateTime)
        } else {
          setCurrentTime(songDuration)
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateTime)

      // 再生終了時
      sourceNodeRef.current.onended = () => {
        if (pausedAtRef.current === 0) {
          playNext()
        }
      }
    } catch (error) {
      console.error('再生エラー:', error)
    }
  }

  // 次の曲
  const playNext = () => {
    if (songs.length === 0) return

    const order = isRandom ? shuffledOrder : songs.map((_, i) => i)
    const currentOrderIndex = order.indexOf(currentIndexRef.current)
    const nextOrderIndex = (currentOrderIndex + 1) % order.length
    const nextIndex = order[nextOrderIndex]

    pausedAtRef.current = 0
    playSong(nextIndex)
  }

  // 前の曲
  const playPrev = () => {
    if (songs.length === 0) return

    const order = isRandom ? shuffledOrder : songs.map((_, i) => i)
    const currentOrderIndex = order.indexOf(currentIndexRef.current)
    const prevOrderIndex = (currentOrderIndex - 1 + order.length) % order.length
    const prevIndex = order[prevOrderIndex]

    pausedAtRef.current = 0
    playSong(prevIndex)
  }

  // 再生/停止トグル
  const togglePlay = async () => {
    if (isPlaying) {
      // 一時停止
      pausedAtRef.current = currentTime
      stopPlayback(false)  // 位置をリセットしない
    } else {
      // 再生再開
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      if (currentIndex !== null) {
        playSong(currentIndex)
      } else if (songs.length > 0) {
        const firstIndex = isRandom ? shuffledOrder[0] : 0
        playSong(firstIndex)
      }
    }
  }

  // 曲をダブルクリック
  const handleSongDoubleClick = (index) => {
    pausedAtRef.current = 0
    playSong(index)
  }

  // 右クリックメニュー
  const handleContextMenu = (e, songId) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      songId
    })
  }

  // 音量変更
  const handleVolumeChange = async (value) => {
    setMasterVolume(value)
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = value
    }
    await savePlaylist({
      settings: { randomPlay: isRandom, masterVolume: value, normalizeTarget },
      songs
    })
  }

  // ランダム切り替え
  const toggleRandom = async () => {
    const newRandom = !isRandom
    setIsRandom(newRandom)
    await savePlaylist({
      settings: { randomPlay: newRandom, masterVolume, normalizeTarget },
      songs
    })
  }

  // 初期化
  useEffect(() => {
    loadPlaylist()
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // シャッフル更新
  useEffect(() => {
    if (isRandom && songs.length > 0) {
      setShuffledOrder(generateShuffledOrder(songs))
    }
  }, [isRandom, songs.length])

  // コンテキストメニューを閉じる
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.player}>
      <div className={styles.header}>
        <h1 className={styles.title}>LUFS Player</h1>
        <button 
          className={`${styles.randomBtn} ${isRandom ? styles.active : ''}`}
          onClick={toggleRandom}
          title="ランダム再生"
        >
          🔀
        </button>
      </div>

      <div className={styles.playlist}>
        {songs.length === 0 ? (
          <div className={styles.empty}>ファイルを追加してください</div>
        ) : (
          songs.map((song, index) => (
            <div
              key={song.id}
              className={`${styles.song} ${currentIndex === index ? styles.active : ''}`}
              onDoubleClick={() => handleSongDoubleClick(index)}
              onContextMenu={(e) => handleContextMenu(e, song.id)}
            >
              <span className={styles.icon}>♪</span>
              <span className={styles.name}>{song.name}</span>
              <span className={styles.duration}>{formatTime(song.duration)}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.addButtons}>
        <button className={styles.addBtn} onClick={handleAddFiles}>
          + ファイル追加
        </button>
        <button className={styles.addBtn} onClick={handleAddFolder}>
          + フォルダー追加
        </button>
      </div>

      <div className={styles.controls}>
        <button className={styles.skipBtn} onClick={playPrev} title="前の曲">
          ⏮
        </button>
        <button className={styles.playBtn} onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className={styles.skipBtn} onClick={playNext} title="次の曲">
          ⏭
        </button>
        <div className={styles.progress}>
          <div className={styles.nowPlaying}>
            {currentIndex !== null ? songs[currentIndex]?.name : ''}
          </div>
          <div className={styles.bar}>
            <div 
              className={styles.fill} 
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className={styles.time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      <div className={styles.volume}>
        <span className={styles.label}>🔊 音量</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        />
        <span className={styles.value}>{Math.round(masterVolume * 100)}%</span>
      </div>

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => handleDelete(contextMenu.songId)}
        >
          削除
        </div>
      )}
    </div>
  )
}
