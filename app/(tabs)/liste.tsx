import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../supabase";

type Item = {
  id: string;
  nom: string;
  prix: string;
  code_barres?: string;
  checked: boolean;
};

type MagasinTotal = {
  magasin: string;
  total: number;
  produitsManquants: number;
};

export default function Liste() {
  const [items, setItems] = useState<Item[]>([]);
  const [newNom, setNewNom] = useState("");
  const [newPrix, setNewPrix] = useState("");
  const [optimisation, setOptimisation] = useState<MagasinTotal[]>([]);
  const [loadingOptim, setLoadingOptim] = useState(false);
  const [showOptim, setShowOptim] = useState(false);

  useEffect(() => {
    chargerListe();
  }, []);

  const chargerListe = async () => {
    const data = await AsyncStorage.getItem("liste_courses");
    if (data) setItems(JSON.parse(data));
  };

  const sauvegarder = async (newItems: Item[]) => {
    await AsyncStorage.setItem("liste_courses", JSON.stringify(newItems));
    setItems(newItems);
  };

  const ajouterItem = () => {
    if (!newNom) return;
    const item: Item = {
      id: Date.now().toString(),
      nom: newNom,
      prix: newPrix,
      checked: false,
    };
    sauvegarder([...items, item]);
    setNewNom("");
    setNewPrix("");
  };

  const toggleCheck = (id: string) => {
    sauvegarder(
      items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
    );
  };

  const supprimerItem = (id: string) => {
    sauvegarder(items.filter((i) => i.id !== id));
  };

  const optimiserCaddie = async () => {
    setLoadingOptim(true);
    setShowOptim(true);

    try {
      const produitsAvecCode = items.filter((i) => i.code_barres && !i.checked);

      if (produitsAvecCode.length === 0) {
        alert(
          "Scanne des produits depuis le scanner pour optimiser ton caddie !",
        );
        setShowOptim(false);
        setLoadingOptim(false);
        return;
      }

      const codes = produitsAvecCode.map((i) => i.code_barres);
      const { data: prixData, error } = await supabase
        .from("prix")
        .select("*")
        .in("code_barres", codes as string[]);

      if (error || !prixData) {
        alert("Erreur lors de la récupération des prix.");
        setLoadingOptim(false);
        return;
      }

      // Grouper par magasin
      const magasins: {
        [key: string]: { total: number; produits: Set<string> };
      } = {};

      for (const produit of produitsAvecCode) {
        const prixProduit = prixData.filter(
          (p) => p.code_barres === produit.code_barres,
        );
        for (const p of prixProduit) {
          if (!magasins[p.magasin]) {
            magasins[p.magasin] = { total: 0, produits: new Set() };
          }
          // Prendre le prix le plus récent par magasin/produit
          if (!magasins[p.magasin].produits.has(p.code_barres)) {
            magasins[p.magasin].total += p.prix;
            magasins[p.magasin].produits.add(p.code_barres);
          }
        }
      }

      const resultats: MagasinTotal[] = Object.entries(magasins)
        .map(([magasin, data]) => ({
          magasin,
          total: parseFloat(data.total.toFixed(2)),
          produitsManquants: produitsAvecCode.length - data.produits.size,
        }))
        .sort((a, b) => a.total - b.total);

      setOptimisation(resultats);
    } catch (e) {
      alert("Erreur.");
    }
    setLoadingOptim(false);
  };

  const total = items
    .filter((i) => !i.checked)
    .reduce((acc, i) => acc + (parseFloat(i.prix) || 0), 0)
    .toFixed(2);

  const totalChecked = items
    .filter((i) => i.checked)
    .reduce((acc, i) => acc + (parseFloat(i.prix) || 0), 0)
    .toFixed(2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>
        Prix<Text style={styles.logoAccent}>Scan</Text>
      </Text>
      <Text style={styles.title}>📋 Ma liste de courses</Text>

      {/* Résumé */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryVal}>
            {items.filter((i) => !i.checked).length}
          </Text>
          <Text style={styles.summaryLabel}>Restants</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: "#00e5a0" }]}>
            {total} €
          </Text>
          <Text style={styles.summaryLabel}>À payer</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: "#6b7080" }]}>
            {totalChecked} €
          </Text>
          <Text style={styles.summaryLabel}>Dans le caddie</Text>
        </View>
      </View>

      {/* Bouton optimiser */}
      <TouchableOpacity style={styles.optimBtn} onPress={optimiserCaddie}>
        <Text style={styles.optimBtnText}>🛒 Optimise mon caddie</Text>
      </TouchableOpacity>

      {/* Résultats optimisation */}
      {showOptim && (
        <View style={styles.optimCard}>
          <Text style={styles.optimTitle}>
            📊 Meilleur magasin pour ta liste
          </Text>
          {loadingOptim ? (
            <ActivityIndicator color="#00e5a0" style={{ marginTop: 12 }} />
          ) : optimisation.length === 0 ? (
            <Text style={styles.optimEmpty}>
              Pas assez de données pour ta liste.
            </Text>
          ) : (
            optimisation.map((m, i) => (
              <View
                key={m.magasin}
                style={[styles.optimRow, i === 0 && styles.optimRowBest]}
              >
                <View style={styles.optimLeft}>
                  {i === 0 && <Text style={styles.optimCrown}>👑</Text>}
                  <Text
                    style={[
                      styles.optimMagasin,
                      i === 0 && { color: "#00e5a0" },
                    ]}
                  >
                    {m.magasin}
                  </Text>
                  {m.produitsManquants > 0 && (
                    <Text style={styles.optimManquant}>
                      {m.produitsManquants} produit(s) manquant(s)
                    </Text>
                  )}
                </View>
                <View style={styles.optimRight}>
                  <Text
                    style={[styles.optimTotal, i === 0 && { color: "#00e5a0" }]}
                  >
                    {m.total.toFixed(2)} €
                  </Text>
                  {i > 0 && (
                    <Text style={styles.optimDiff}>
                      +{(m.total - optimisation[0].total).toFixed(2)} €
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
          <TouchableOpacity
            onPress={() => setShowOptim(false)}
            style={styles.closeOptim}
          >
            <Text style={styles.closeOptimText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Formulaire ajout */}
      <View style={styles.form}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Produit (ex: Lait)"
          placeholderTextColor="#6b7080"
          value={newNom}
          onChangeText={setNewNom}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Prix"
          placeholderTextColor="#6b7080"
          value={newPrix}
          onChangeText={setNewPrix}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.addBtn} onPress={ajouterItem}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Ta liste est vide 🛒</Text>
          <Text style={styles.emptySub}>
            Scanne un produit et ajoute-le à ta liste !
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
            style={[styles.item, item.checked && styles.itemChecked]}
          >
            <TouchableOpacity
              style={[styles.check, item.checked && styles.checkDone]}
              onPress={() => toggleCheck(item.id)}
            >
              {item.checked && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text
                style={[styles.itemNom, item.checked && styles.itemNomChecked]}
              >
                {item.nom}
              </Text>
              {item.prix ? (
                <Text style={styles.itemPrix}>
                  {parseFloat(item.prix).toFixed(2)} €
                </Text>
              ) : null}
              {item.code_barres && (
                <Text style={styles.itemCode}>✅ Prix comparables</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => supprimerItem(item.id)}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f13" },
  content: { padding: 24, paddingTop: 60, paddingBottom: 100 },
  logo: { fontSize: 24, fontWeight: "800", color: "#f0f2ff", marginBottom: 4 },
  logoAccent: { color: "#00e5a0" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f0f2ff",
    marginBottom: 16,
  },
  summary: {
    flexDirection: "row",
    backgroundColor: "#16181f",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2d3a",
    justifyContent: "space-around",
  },
  summaryItem: { alignItems: "center" },
  summaryVal: { fontSize: 22, fontWeight: "800", color: "#f0f2ff" },
  summaryLabel: { fontSize: 11, color: "#6b7080", marginTop: 2 },
  optimBtn: {
    backgroundColor: "#00e5a0",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  optimBtnText: { color: "#0a1a12", fontWeight: "800", fontSize: 16 },
  optimCard: {
    backgroundColor: "#16181f",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2a2d3a",
  },
  optimTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f0f2ff",
    marginBottom: 12,
  },
  optimEmpty: {
    color: "#6b7080",
    fontSize: 13,
    textAlign: "center",
    padding: 12,
  },
  optimRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2d3a",
  },
  optimRowBest: {
    backgroundColor: "rgba(0,229,160,0.05)",
    borderRadius: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  optimLeft: { flex: 1 },
  optimCrown: { fontSize: 16, marginBottom: 2 },
  optimMagasin: { color: "#f0f2ff", fontWeight: "700", fontSize: 15 },
  optimManquant: { color: "#f5c542", fontSize: 11, marginTop: 2 },
  optimRight: { alignItems: "flex-end" },
  optimTotal: { fontWeight: "800", fontSize: 18, color: "#f0f2ff" },
  optimDiff: { color: "#ff4f4f", fontSize: 12, marginTop: 2 },
  closeOptim: { alignItems: "center", marginTop: 12 },
  closeOptimText: { color: "#6b7080", fontSize: 13 },
  form: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: {
    backgroundColor: "#16181f",
    borderWidth: 1,
    borderColor: "#2a2d3a",
    borderRadius: 12,
    padding: 12,
    color: "#f0f2ff",
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: "#00e5a0",
    borderRadius: 12,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#0a1a12", fontSize: 24, fontWeight: "800" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16181f",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2a2d3a",
    gap: 12,
  },
  itemChecked: { opacity: 0.5 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#2a2d3a",
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: "#00e5a0", borderColor: "#00e5a0" },
  checkMark: { color: "#0a1a12", fontWeight: "800", fontSize: 12 },
  itemInfo: { flex: 1 },
  itemNom: { color: "#f0f2ff", fontWeight: "600", fontSize: 15 },
  itemNomChecked: { textDecorationLine: "line-through" },
  itemPrix: { color: "#00e5a0", fontSize: 13, marginTop: 2 },
  itemCode: { color: "#6b7080", fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteText: { color: "#6b7080", fontSize: 16 },
  emptyBox: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#f0f2ff", fontSize: 18, fontWeight: "700" },
  emptySub: {
    color: "#6b7080",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
});
