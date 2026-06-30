import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useBetStore } from '../store/useBetStore';

const COLORS = {
  primary: '#4f46e5',
  emerald: '#059669',
  bg: '#f8fafc',
  border: '#e2e8f0',
  cardBg: '#fff',
  live: '#ef4444',
  textDark: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
};

export default function MatchCard({ match }) {
  const selectedOdds = useBetStore((state) => state.selectedOdds);
  const toggleOdd = useBetStore((state) => state.toggleOdd);
  const [expanded, setExpanded] = useState(false);

  const isLive = ['live', 'half_time', 'live_1h', 'live_2h'].includes(match.status);
  const isFinished = match.status === 'finished';
  const isPastStartTime = new Date(match.start_date) <= new Date();
  const isLiveOrFinished = isLive || isFinished || isPastStartTime;

  const getOdd = (...types) => match.odds?.find(o => types.includes(o.bet_type));

  // All odds
  const ms1 = getOdd('MS 1');
  const ms0 = getOdd('MS 0', 'MS X');
  const ms2 = getOdd('MS 2');
  const iy1 = getOdd('İY 1', 'IY 1');
  const iy0 = getOdd('İY 0', 'IY 0');
  const iy2 = getOdd('İY 2', 'IY 2');
  const alt25 = getOdd('2.5 Alt');
  const ust25 = getOdd('2.5 Üst');
  const alt15 = getOdd('1.5 Alt');
  const ust15 = getOdd('1.5 Üst');
  const alt35 = getOdd('3.5 Alt');
  const ust35 = getOdd('3.5 Üst');
  const kgVar = getOdd('KG Var');
  const kgYok = getOdd('KG Yok');
  const cs1x = getOdd('ÇŞ 1-X');
  const cs12 = getOdd('ÇŞ 1-2');
  const csx2 = getOdd('ÇŞ X-2');
  const iyAlt15 = getOdd('İY 1.5 Alt');
  const iyUst15 = getOdd('İY 1.5 Üst');

  const getStatusLabel = () => {
    if (isFinished) return { text: 'MS', color: COLORS.textMuted };
    if (isLive) return { text: match.minute || 'CANLI', color: COLORS.live };
    if (isPastStartTime) return { text: 'Başladı', color: '#f59e0b' };
    return {
      text: new Date(match.start_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      color: COLORS.textDark
    };
  };

  const status = getStatusLabel();

  const OddBtn = ({ oddObj, label }) => {
    if (!oddObj) {
      return (
        <View style={s.oddEmpty}>
          <Text style={s.oddEmptyTxt}>-</Text>
        </View>
      );
    }
    const isSelected = selectedOdds.some(item => item.odd.id === oddObj.id);
    return (
      <TouchableOpacity
        style={[s.oddBtn, isSelected && s.oddBtnSelected, isLiveOrFinished && s.oddDisabled]}
        onPress={() => { if (!isLiveOrFinished) toggleOdd(match, oddObj); }}
        disabled={isLiveOrFinished}
        activeOpacity={0.75}
      >
        <Text style={[s.oddLbl, isSelected && s.textWhite]}>{label}</Text>
        <Text style={[s.oddVal, isSelected && s.textWhite]}>{oddObj.odd_value.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  const OddGroup = ({ title, children }) => (
    <View style={s.oddGroup}>
      <Text style={s.oddGroupTitle}>{title}</Text>
      <View style={s.oddGroupRow}>{children}</View>
    </View>
  );

  return (
    <View style={s.card}>
      {/* Header: Status + Teams + Score */}
      <View style={s.header}>
        <View style={s.statusBox}>
          <Text style={[s.statusTxt, { color: status.color }]}>{status.text}</Text>
          {match.league ? (
            <Text style={s.leagueTxt} numberOfLines={1}>{match.league}</Text>
          ) : null}
        </View>

        <View style={s.teamsRow}>
          <Text style={s.teamName} numberOfLines={1}>{match.home_team}</Text>
          <View style={s.scoreBox}>
            {isLiveOrFinished ? (
              <Text style={s.scoreTxt}>{match.home_score ?? 0} - {match.away_score ?? 0}</Text>
            ) : (
              <Text style={s.scoreTxt}>–</Text>
            )}
          </View>
          <Text style={s.teamName} numberOfLines={1}>{match.away_team}</Text>
        </View>
      </View>

      {/* Main odds row + expand button */}
      {!isLiveOrFinished && (
        <>
          <View style={s.mainOddsRow}>
            <View style={s.mainOddsGroup}>
              <OddBtn oddObj={ms1} label="MS 1" />
              <OddBtn oddObj={ms0} label="MS X" />
              <OddBtn oddObj={ms2} label="MS 2" />
            </View>
            <TouchableOpacity
              style={s.expandBtn}
              onPress={() => setExpanded(v => !v)}
            >
              <Text style={s.expandBtnTxt}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          </View>

          {/* Expanded odds */}
          {expanded && (
            <View style={s.expandedContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.expandedInner}>
                  <OddGroup title="İlk Yarı">
                    <OddBtn oddObj={iy1} label="İY 1" />
                    <OddBtn oddObj={iy0} label="İY X" />
                    <OddBtn oddObj={iy2} label="İY 2" />
                  </OddGroup>
                  <OddGroup title="Çifte Şans">
                    <OddBtn oddObj={cs1x} label="1-X" />
                    <OddBtn oddObj={cs12} label="1-2" />
                    <OddBtn oddObj={csx2} label="X-2" />
                  </OddGroup>
                  <OddGroup title="Alt / Üst">
                    <OddBtn oddObj={alt15} label="1.5 A" />
                    <OddBtn oddObj={ust15} label="1.5 Ü" />
                    <OddBtn oddObj={alt25} label="2.5 A" />
                    <OddBtn oddObj={ust25} label="2.5 Ü" />
                    <OddBtn oddObj={alt35} label="3.5 A" />
                    <OddBtn oddObj={ust35} label="3.5 Ü" />
                  </OddGroup>
                  <OddGroup title="İY Alt / Üst">
                    <OddBtn oddObj={iyAlt15} label="1.5 A" />
                    <OddBtn oddObj={iyUst15} label="1.5 Ü" />
                  </OddGroup>
                  <OddGroup title="Karşılıklı Gol">
                    <OddBtn oddObj={kgVar} label="Var" />
                    <OddBtn oddObj={kgYok} label="Yok" />
                  </OddGroup>
                </View>
              </ScrollView>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusTxt: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  leagueTxt: {
    fontSize: 10,
    color: '#94a3b8',
    flexShrink: 1,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  scoreTxt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  mainOddsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  mainOddsGroup: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  expandBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  expandBtnTxt: {
    fontSize: 10,
    color: '#64748b',
  },
  expandedContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  expandedInner: {
    flexDirection: 'row',
    gap: 16,
  },
  oddGroup: {
    alignItems: 'flex-start',
  },
  oddGroupTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  oddGroupRow: {
    flexDirection: 'row',
    gap: 4,
  },
  oddBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 52,
  },
  oddBtnSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  oddDisabled: {
    opacity: 0.5,
  },
  oddEmpty: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 52,
    backgroundColor: '#f1f5f9',
  },
  oddEmptyTxt: {
    color: '#94a3b8',
    fontSize: 11,
  },
  oddLbl: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 1,
  },
  oddVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  textWhite: {
    color: '#fff',
  },
});
