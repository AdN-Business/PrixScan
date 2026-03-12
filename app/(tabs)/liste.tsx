import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Item = {
  id: string;
  nom: string;
  prix: string;
  checked: boolean;
};

export default function Liste() {
  const [items, setItems] = useState<Item[]>([]);
  const [newNom, setNewNom] = useState("");
  const [newPrix, setNewPrix] = useState("");

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
            Ajoute des produits ou scanne un code-barres !
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a2d3a",
    justifyContent: "space-around",
  },
  summaryItem: { alignItems: "center" },
  summaryVal: { fontSize: 22, fontWeight: "800", color: "#f0f2ff" },
  summaryLabel: { fontSize: 11, color: "#6b7080", marginTop: 2 },
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
