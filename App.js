import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('artworks.db');

export default function App() {
  const [screen, setScreen] = useState('home');
  const [selectedRounds, setSelectedRounds] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentArtwork, setCurrentArtwork] = useState(null);
  const [usedIds, setUsedIds] = useState([]);
  const [titleInput, setTitleInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [scores, setScores] = useState({ titles: 0, authors: 0, years: 0 });
  const [currentYearDiff, setCurrentYearDiff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initDatabase();
  }, []);

  const initDatabase = async () => {
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS artworks (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          year_start INTEGER NOT NULL,
          year_end INTEGER NOT NULL,
          picture TEXT NOT NULL
        );
      `);

      const result = await db.getAllAsync('SELECT COUNT(*) as count FROM artworks');
      
      if (result[0].count === 0) {
        await db.runAsync(
          `INSERT INTO artworks (id, title, author, year_start, year_end, picture) VALUES 
          (1, 'Portrét Arnolfiniho', 'Jan van Eyck', 1434, 1434, 'https://github.com/4Tomek/art_images/releases/download/v1.0/portret_arnolfiniho.jpg'),
          (2, 'Zrození Venuše', 'Sandro Botticelli', 1484, 1486, 'https://github.com/4Tomek/art_images/releases/download/v1.0/zrozeni_venuse.jpg'),
          (3, 'Mona Lisa', 'Leonardo da Vinci', 1503, 1506, 'https://github.com/4Tomek/art_images/releases/download/v1.0/mona_lisa.jpg'),
          (4, 'Dívka s perlou', 'Johannes Vermeer', 1665, 1665, 'https://github.com/4Tomek/art_images/releases/download/v1.0/divka_s_perlou.jpg'),
          (5, 'Hvězdná noc', 'Vincent van Gogh', 1889, 1889, 'https://github.com/4Tomek/art_images/releases/download/v1.0/hvezdna_noc.jpg'),
          (6, 'Výkřik', 'Edvard Munch', 1893, 1893, 'https://github.com/4Tomek/art_images/releases/download/v1.0/mona_lisa.jpg'),
          (7, 'Kompozice A', 'Piet Mondrian', 1920, 1920, 'https://github.com/4Tomek/art_images/releases/download/v1.0/composition_a.jpg')`
        );
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Chyba při inicializaci databáze:', error);
      Alert.alert('Chyba', 'Nepodařilo se inicializovat databázi');
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    setScreen('quiz');
    setCurrentRound(1);
    setUsedIds([]);
    setScores({ titles: 0, authors: 0, years: 0 });
    await loadRandomArtwork([]);
  };

  const loadRandomArtwork = async (excludeIds) => {
    try {
      const placeholders = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '';
      const query = excludeIds.length > 0 
        ? `SELECT * FROM artworks WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
        : 'SELECT * FROM artworks ORDER BY RANDOM() LIMIT 1';
      
      const result = await db.getAllAsync(query, excludeIds);
      
      if (result.length > 0) {
        setCurrentArtwork(result[0]);
        setTitleInput('');
        setAuthorInput('');
        setYearInput('');
        setShowAnswer(false);
        setCurrentYearDiff(null);
      } else {
        showResults();
      }
    } catch (error) {
      console.error('Chyba při načítání obrázku:', error);
      Alert.alert('Chyba', 'Nepodařilo se načíst obrázek');
    }
  };

  const handleSubmit = () => {
    if (!currentArtwork) return;

    let newScores = { ...scores };
    let yearDiff = null;

    if (titleInput.trim().toLowerCase() === currentArtwork.title.toLowerCase()) {
      newScores.titles += 1;
    }

    if (authorInput.trim().toLowerCase() === currentArtwork.author.toLowerCase()) {
      newScores.authors += 1;
    }

    if (yearInput.trim() === '') {
      newScores.years += 500;
      yearDiff = 'penalizace: +500';
    } else {
      const year = parseInt(yearInput);
      if (!isNaN(year)) {
        if (year < currentArtwork.year_start) {
          const diff = currentArtwork.year_start - year;
          newScores.years += diff;
          yearDiff = `(+${diff})`;
        } else if (year > currentArtwork.year_end) {
          const diff = year - currentArtwork.year_end;
          newScores.years += diff;
          yearDiff = `(+${diff})`;
        } else {
          yearDiff = '(0)';
        }
      }
    }

    setScores(newScores);
    setCurrentYearDiff(yearDiff);
    setShowAnswer(true);
  };

  const handleNext = async () => {
    const newUsedIds = [...usedIds, currentArtwork.id];
    setUsedIds(newUsedIds);

    if (currentRound < selectedRounds) {
      setCurrentRound(currentRound + 1);
      await loadRandomArtwork(newUsedIds);
    } else {
      showResults();
    }
  };

  const showResults = () => {
    setScreen('results');
  };

  const resetQuiz = () => {
    setScreen('home');
    setSelectedRounds(1);
    setCurrentRound(1);
    setCurrentArtwork(null);
    setUsedIds([]);
    setTitleInput('');
    setAuthorInput('');
    setYearInput('');
    setShowAnswer(false);
    setScores({ titles: 0, authors: 0, years: 0 });
    setCurrentYearDiff(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Načítání...</Text>
      </View>
    );
  }

  if (screen === 'home') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Kvíz uměleckých děl</Text>
        <Text style={styles.subtitle}>Vyber počet kol:</Text>
        
        <View style={styles.buttonGroup}>
          {[1, 2, 3].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.roundButton, selectedRounds === num && styles.roundButtonSelected]}
              onPress={() => setSelectedRounds(num)}
            >
              <Text style={[styles.roundButtonText, selectedRounds === num && styles.roundButtonTextSelected]}>
                {num} {num === 1 ? 'round' : 'rounds'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
          <Text style={styles.startButtonText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'quiz' && currentArtwork) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreText}>Round: {currentRound}/{selectedRounds}</Text>
          <Text style={styles.scoreText}>Titles: {scores.titles}</Text>
          <Text style={styles.scoreText}>Authors: {scores.authors}</Text>
          <Text style={styles.scoreText}>Years: {scores.years}</Text>
        </View>

        <Image source={{ uri: currentArtwork.picture }} style={styles.artworkImage} resizeMode="contain" />

        {!showAnswer ? (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Title:</Text>
            <TextInput style={styles.input} value={titleInput} onChangeText={setTitleInput} placeholder="Zadej název díla" />

            <Text style={styles.label}>Author:</Text>
            <TextInput style={styles.input} value={authorInput} onChangeText={setAuthorInput} placeholder="Zadej autora" />

            <Text style={styles.label}>Year:</Text>
            <TextInput style={styles.input} value={yearInput} onChangeText={setYearInput} placeholder="Zadej rok" keyboardType="numeric" />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.answerContainer}>
            <Text style={styles.answerTitle}>Správné odpovědi:</Text>
            <Text style={styles.answerText}>Title: {currentArtwork.title}</Text>
            <Text style={styles.answerText}>Author: {currentArtwork.author}</Text>
            <Text style={styles.answerText}>Year: {currentArtwork.year_start === currentArtwork.year_end ? currentArtwork.year_start : `${currentArtwork.year_start}-${currentArtwork.year_end}`}</Text>

            {currentYearDiff && <Text style={styles.diffText}>Tvůj rok: {currentYearDiff}</Text>}

            <View style={styles.currentScoreContainer}>
              <Text style={styles.currentScoreTitle}>Průběžné výsledky:</Text>
              <Text style={styles.currentScoreText}>Round: {currentRound}/{selectedRounds}</Text>
              <Text style={styles.currentScoreText}>Titles: {scores.titles}</Text>
              <Text style={styles.currentScoreText}>Authors: {scores.authors}</Text>
              <Text style={styles.currentScoreText}>Years: {scores.years}</Text>
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>NEXT</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  if (screen === 'results') {
    return (
      <View style={styles.container}>
        <Text style={styles.resultsTitle}>Tvoje skóre:</Text>
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>Rounds: {selectedRounds}</Text>
          <Text style={styles.resultsText}>Titles: {scores.titles}</Text>
          <Text style={styles.resultsText}>Authors: {scores.authors}</Text>
          <Text style={styles.resultsText}>Years: {scores.years}</Text>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={resetQuiz}>
          <Text style={styles.startButtonText}>NOVÁ HRA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50 },
  scrollContent: { paddingBottom: 30 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  subtitle: { fontSize: 20, textAlign: 'center', marginBottom: 20, color: '#666' },
  buttonGroup: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, paddingHorizontal: 20 },
  roundButton: { backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 20, marginHorizontal: 5, borderRadius: 10, borderWidth: 2, borderColor: '#ddd' },
  roundButtonSelected: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  roundButtonText: { fontSize: 16, color: '#333', fontWeight: '600' },
  roundButtonTextSelected: { color: '#fff' },
  startButton: { backgroundColor: '#4CAF50', paddingVertical: 15, paddingHorizontal: 60, borderRadius: 10, alignSelf: 'center' },
  startButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  scoreHeader: { backgroundColor: '#fff', padding: 15, marginHorizontal: 20, marginBottom: 15, borderRadius: 10, elevation: 2 },
  scoreText: { fontSize: 16, marginVertical: 2, color: '#333' },
  artworkImage: { width: '90%', height: 300, alignSelf: 'center', marginBottom: 20, borderRadius: 10 },
  inputContainer: { paddingHorizontal: 20 },
  label: { fontSize: 18, fontWeight: '600', marginTop: 10, marginBottom: 5, color: '#333' },
  input: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
  submitButton: { backgroundColor: '#2196F3', paddingVertical: 15, borderRadius: 10, marginTop: 20 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  answerContainer: { paddingHorizontal: 20 },
  answerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  answerText: { fontSize: 18, marginVertical: 5, color: '#555' },
  diffText: { fontSize: 16, marginTop: 10, color: '#FF5722', fontWeight: '600' },
  currentScoreContainer: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 10, marginTop: 20, marginBottom: 20 },
  currentScoreTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1976D2' },
  currentScoreText: { fontSize: 16, marginVertical: 3, color: '#333' },
  nextButton: { backgroundColor: '#4CAF50', paddingVertical: 15, borderRadius: 10 },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  resultsTitle: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#333' },
  resultsContainer: { backgroundColor: '#fff', padding: 30, marginHorizontal: 20, borderRadius: 15, elevation: 4, marginBottom: 40 },
  resultsText: { fontSize: 24, marginVertical: 10, color: '#333', fontWeight: '600' },
});