/**
 * 棋譜データや解析結果などを永続化領域に保存・読み込みするモジュール。
 * 
 * データのシリアライズを行い、ブラウザ再読み込み時の状態復元を担う。
 * 
 * 主な役割:
 * - 永続化ストレージへのI/O処理の抽象化
 * - 保存データのマイグレーション管理
 */

export function hasStoredGameRecords() {
    return localStorage.getItem('games') !== null;
}

export function loadGameRecords() {
    return JSON.parse(localStorage.getItem('games') || '[]');
}

export function loadGameRecordsNewestFirst() {
    return loadGameRecords().reverse();
}

export function saveGameRecords(records) {
    localStorage.setItem('games', JSON.stringify(records));
}

export function appendGameRecord(record) {
    const records = loadGameRecords();
    records.push(record);
    saveGameRecords(records);
}

export function updateGameRecordEvalsById(targetRecordId, newEvals) {
    const records = loadGameRecords();
    const index = records.findIndex(record => record.id === targetRecordId);
    if (index === -1) return false;

    records[index].evals = newEvals;
    saveGameRecords(records);
    return true;
}

export function findGameRecordById(recordId) {
    return loadGameRecords().find(record => record.id == recordId);
}

export function deleteGameRecordById(recordId) {
    const records = loadGameRecords().filter(record => record.id != recordId);
    saveGameRecords(records);
    return records;
}

export function saveQuizList(quizList) {
    localStorage.setItem('quizzes', JSON.stringify(quizList));
}

export function loadQuizList() {
    const quizData = localStorage.getItem('quizzes');
    return quizData ? JSON.parse(quizData) : null;
}
