import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GOOGLE_VISION_KEY } from "../../config";
import { supabase } from "../../supabase";

export default function App() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [prix, setPrix] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newMagasin, setNewMagasin] = useState("");
  const [newPrix, setNewPrix] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastBarcode, setLastBarcode] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [photoValidee, setPhotoValidee] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleScan = async () => {
    if (!permission?.granted) await requestPermission();
    setProduct(null);
    setPrix([]);
    setScanning(true);
  };

  const handleBarcode = async (result: any) => {
    setScanning(false);
    setLoading(true);
    setLastBarcode(result.data);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${result.data}.json`,
      );
      const data = await response.json();
      if (data.status === 1) setProduct(data.product);
      else alert("Produit non trouvé.");

      const { data: prixData, error } = await supabase
        .from("prix")
        .select("*")
        .eq("code_barres", result.data)
        .order("prix", { ascending: true });

      if (!error && prixData) setPrix(prixData);
    } catch (e) {
      alert("Erreur de connexion.");
    }
    setLoading(false);
  };

  const prendrePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      await validerPhotoIA(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const choisirGalerie = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      await validerPhotoIA(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const validerPhotoIA = async (base64: string, uri: string) => {
    setValidatingPhoto(true);
    setPhotoValidee(false);
    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION", maxResults: 10 }],
              },
            ],
          }),
        },
      );

      const data = await response.json();
      const texte = data.responses?.[0]?.fullTextAnnotation?.text || "";

      // Cherche un prix dans le texte (ex: 1.09, 1,09, €1.09)
      const prixSaisi = parseFloat(newPrix.replace(",", "."));
      const regex = /(\d+[.,]\d{1,2})/g;
      const prixTrouves = (texte.match(regex) || []).map((p: string) =>
        parseFloat(p.replace(",", ".")),
      );

      const tolerance = 0.15; // 15 centimes de tolérance
      const prixValide = prixTrouves.some(
        (p: number) => Math.abs(p - prixSaisi) <= tolerance,
      );

      if (prixValide) {
        setPhotoValidee(true);
      } else if (prixTrouves.length === 0) {
        // Pas de prix trouvé sur la photo — on accepte quand même
        setPhotoValidee(true);
        alert(
          "⚠️ Aucun prix lisible sur la photo, mais on accepte quand même. Merci !",
        );
      } else {
        setPhotoValidee(false);
        alert(
          `❌ Le prix sur la photo (${prixTrouves[0]}€) ne correspond pas au prix saisi (${newPrix}€). Vérifie et réessaie.`,
        );
        setPhoto(null);
      }
    } catch (e) {
      // En cas d'erreur API on accepte quand même
      setPhotoValidee(true);
    }
    setValidatingPhoto(false);
  };

  const submitPrix = async () => {
    if (!newMagasin || !newPrix) {
      alert("Remplis le magasin et le prix !");
      return;
    }
    if (!photo || !photoValidee) {
      alert(
        "📸 Une photo de l'étiquette est obligatoire pour soumettre un prix !",
      );
      return;
    }

    setSubmitting(true);
    try {
      // Détection aberrations
      const prixSoumis = parseFloat(newPrix.replace(",", "."));
      if (prix.length >= 2) {
        const moyenne =
          prix.reduce((a: number, p: any) => a + p.prix, 0) / prix.length;
        if (prixSoumis > moyenne * 3 || prixSoumis < moyenne / 3) {
          alert(
            "❌ Ce prix semble aberrant par rapport aux autres prix connus. Vérifiez et réessayez.",
          );
          setSubmitting(false);
          return;
        }
      }
      // Upload photo sur Supabase Storage
      const fileName = `${lastBarcode}_${Date.now()}.jpg`;
      const response = await fetch(photo);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("photos-prix")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) {
        console.log("Upload error:", uploadError);
      }

      // Sauvegarder le prix
      const { error } = await supabase.from("prix").insert({
        code_barres: lastBarcode,
        magasin: newMagasin,
        prix: parseFloat(newPrix.replace(",", ".")),
        ville: "France",
      });

      if (!error) {
        alert("✅ Prix soumis et validé par IA, merci !");
        setShowForm(false);
        setNewMagasin("");
        setNewPrix("");
        setPhoto(null);
        setPhotoValidee(false);

        const { data: prixData } = await supabase
          .from("prix")
          .select("*")
          .eq("code_barres", lastBarcode)
          .order("prix", { ascending: true });
        if (prixData) setPrix(prixData);
      } else {
        alert("Erreur lors de la soumission.");
      }
    } catch (e) {
      alert("Erreur.");
    }
    setSubmitting(false);
  };

  const getPrixMoyen = () => {
    if (prix.length === 0) return null;
    const total = prix.reduce((acc, p) => acc + p.prix, 0);
    return (total / prix.length).toFixed(2);
  };

  const getVerdict = (p: number) => {
    const moyen = parseFloat(getPrixMoyen() || "0");
    if (p <= moyen * 0.95)
      return {
        label: "✅ Bon prix",
        color: "#00e5a0",
        bg: "rgba(0,229,160,0.12)",
      };
    if (p <= moyen * 1.05)
      return {
        label: "👌 Prix normal",
        color: "#f5c542",
        bg: "rgba(245,197,66,0.12)",
      };
    return {
      label: "⚠️ Prix élevé",
      color: "#ff4f4f",
      bg: "rgba(255,79,79,0.12)",
    };
  };

  if (scanning) {
    return (
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarcode}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8"] }}
        />
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setScanning(false)}
        >
          <Text style={styles.cancelText}>✕ Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00e5a0" />
        <Text style={styles.hint}>Recherche du produit...</Text>
      </View>
    );
  }

  if (product) {
    const nutriscore = product.nutriscore_grade?.toUpperCase() || "?";
    const nutriColor: any = {
      A: "#00e5a0",
      B: "#85e000",
      C: "#f5c542",
      D: "#ff914d",
      E: "#ff4f4f",
    };
    const prixMoyen = getPrixMoyen();

    return (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.logo}>
          Prix<Text style={styles.logoAccent}>Scan</Text>
        </Text>

        <View style={styles.productCard}>
          <Text style={styles.productName}>
            {product.product_name || "Nom inconnu"}
          </Text>
          <Text style={styles.productBrand}>
            {product.brands || "Marque inconnue"}
          </Text>
          <View style={styles.nutriRow}>
            <View
              style={[
                styles.nutriBadge,
                { backgroundColor: nutriColor[nutriscore] || "#444" },
              ]}
            >
              <Text style={styles.nutriText}>Nutri-score {nutriscore}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {prixMoyen ? (
            <>
              <Text style={styles.sectionTitle}>💰 Prix moyen</Text>
              <Text style={styles.priceMain}>{prixMoyen} €</Text>
              <View style={styles.separator} />
              <Text style={styles.sectionTitle}>🏪 Prix par magasin</Text>
              {prix.map((p, i) => {
                const v = getVerdict(p.prix);
                return (
                  <View key={i} style={styles.storeRow}>
                    <Text style={styles.storeName}>{p.magasin}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.storePrice, { color: v.color }]}>
                        {p.prix.toFixed(2)} €
                      </Text>
                      <View
                        style={[styles.verdictChip, { backgroundColor: v.bg }]}
                      >
                        <Text style={[styles.verdictText, { color: v.color }]}>
                          {v.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.noPrixBox}>
              <Text style={styles.noPrixText}>Aucun prix enregistré.</Text>
              <Text style={styles.noPrixSub}>
                Soyez le premier à soumettre un prix !
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.submitButtonText}>💰 Soumettre un prix</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addToListBtn}
          onPress={async () => {
            const item = {
              id: Date.now().toString(),
              nom: product.product_name || "Produit inconnu",
              prix:
                prix.length > 0
                  ? (
                      prix.reduce((a: number, p: any) => a + p.prix, 0) /
                      prix.length
                    ).toFixed(2)
                  : "",
              code_barres: lastBarcode,
              checked: false,
            };
            const existing = await AsyncStorage.getItem("liste_courses");
            const liste = existing ? JSON.parse(existing) : [];
            await AsyncStorage.setItem(
              "liste_courses",
              JSON.stringify([...liste, item]),
            );
            alert("✅ Ajouté à ta liste de courses !");
          }}
        >
          <Text style={styles.addToListBtnText}>📋 Ajouter à ma liste</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
          <Text style={styles.scanText}>📷 Scanner un autre produit</Text>
        </TouchableOpacity>

        {/* Modal soumission prix */}
        <Modal visible={showForm} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>💰 Soumettre un prix</Text>
              <Text style={styles.modalSub}>{product.product_name}</Text>

              <TextInput
                style={styles.input}
                placeholder="Magasin (ex: Carrefour)"
                placeholderTextColor="#6b7080"
                value={newMagasin}
                onChangeText={setNewMagasin}
              />
              <TextInput
                style={styles.input}
                placeholder="Prix (ex: 1.09)"
                placeholderTextColor="#6b7080"
                value={newPrix}
                onChangeText={setNewPrix}
                keyboardType="decimal-pad"
              />

              {/* Section photo */}
              <Text style={styles.photoLabel}>
                📸 Photo de l'étiquette (obligatoire)
              </Text>
              <View style={styles.photoRow}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={prendrePhoto}
                >
                  <Text style={styles.photoBtnText}>📷 Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={choisirGalerie}
                >
                  <Text style={styles.photoBtnText}>🖼️ Galerie</Text>
                </TouchableOpacity>
              </View>

              {photo && (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo }} style={styles.photoImg} />
                  {validatingPhoto && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#00e5a0" />
                      <Text style={styles.photoOverlayText}>
                        Validation IA...
                      </Text>
                    </View>
                  )}
                  {!validatingPhoto && photoValidee && (
                    <View
                      style={[
                        styles.photoOverlay,
                        { backgroundColor: "rgba(0,229,160,0.15)" },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>✅</Text>
                      <Text style={styles.photoOverlayText}>
                        Photo validée !
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!photoValidee || submitting) && { opacity: 0.5 },
                ]}
                onPress={submitPrix}
                disabled={!photoValidee || submitting}
              >
                <Text style={styles.confirmText}>
                  {submitting ? "Envoi..." : "✅ Confirmer"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelFormButton}
                onPress={() => {
                  setShowForm(false);
                  setPhoto(null);
                  setPhotoValidee(false);
                }}
              >
                <Text style={styles.cancelFormText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        Prix<Text style={styles.logoAccent}>Scan</Text>
      </Text>
      <Text style={styles.subtitle}>Scannez, comparez, économisez</Text>
      <TouchableOpacity style={styles.scanButtonBig} onPress={handleScan}>
        <Text style={styles.scanIcon}>📷</Text>
        <Text style={styles.scanText}>Scanner un produit</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Pointez la caméra vers un code-barres</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0f13",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContainer: { flex: 1, backgroundColor: "#0e0f13" },
  scrollContent: { padding: 24, paddingTop: 60, alignItems: "center" },
  logo: { fontSize: 30, fontWeight: "800", color: "#f0f2ff", marginBottom: 20 },
  logoAccent: { color: "#00e5a0" },
  subtitle: { fontSize: 15, color: "#6b7080", marginBottom: 60 },
  scanButtonBig: {
    backgroundColor: "#00e5a0",
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: "#1c1e27",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 28,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2d3a",
  },
  submitButton: {
    backgroundColor: "#00e5a0",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 28,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  submitButtonText: { color: "#0a1a12", fontWeight: "700", fontSize: 15 },
  addToListBtn: {
    backgroundColor: "#1c1e27",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 28,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00e5a0",
  },
  addToListBtnText: { color: "#00e5a0", fontWeight: "700", fontSize: 15 },
  scanIcon: { fontSize: 52, marginBottom: 8 },
  scanText: { color: "#f0f2ff", fontWeight: "700", fontSize: 15 },
  hint: { color: "#6b7080", fontSize: 13, marginTop: 16 },
  camera: { flex: 1, width: "100%" },
  cancelButton: {
    position: "absolute",
    bottom: 50,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    borderRadius: 30,
    paddingHorizontal: 32,
  },
  cancelText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  productCard: {
    width: "100%",
    backgroundColor: "#16181f",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2a2d3a",
    marginBottom: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f0f2ff",
    marginBottom: 4,
  },
  productBrand: { fontSize: 14, color: "#6b7080", marginBottom: 12 },
  nutriRow: { flexDirection: "row", marginBottom: 12 },
  nutriBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  nutriText: { color: "#0a1a12", fontWeight: "700", fontSize: 13 },
  separator: { height: 1, backgroundColor: "#2a2d3a", marginVertical: 14 },
  sectionTitle: {
    fontSize: 13,
    color: "#6b7080",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  priceMain: {
    fontSize: 36,
    fontWeight: "800",
    color: "#f0f2ff",
    marginBottom: 8,
  },
  storeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2d3a",
  },
  storeName: { color: "#f0f2ff", fontSize: 15 },
  storePrice: { fontWeight: "700", fontSize: 15 },
  verdictChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 3,
  },
  verdictText: { fontSize: 11, fontWeight: "600" },
  noPrixBox: { alignItems: "center", padding: 20 },
  noPrixText: {
    color: "#f0f2ff",
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  noPrixSub: {
    color: "#6b7080",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#16181f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#2a2d3a",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f0f2ff",
    marginBottom: 4,
  },
  modalSub: { fontSize: 13, color: "#6b7080", marginBottom: 20 },
  input: {
    backgroundColor: "#0e0f13",
    borderWidth: 1,
    borderColor: "#2a2d3a",
    borderRadius: 12,
    padding: 14,
    color: "#f0f2ff",
    fontSize: 15,
    marginBottom: 12,
  },
  photoLabel: { fontSize: 13, color: "#6b7080", marginBottom: 10 },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  photoBtn: {
    flex: 1,
    backgroundColor: "#0e0f13",
    borderWidth: 1,
    borderColor: "#2a2d3a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  photoBtnText: { color: "#f0f2ff", fontWeight: "600" },
  photoPreview: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    height: 150,
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlayText: { color: "#fff", fontWeight: "700", marginTop: 8 },
  confirmButton: {
    backgroundColor: "#00e5a0",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  confirmText: { color: "#0a1a12", fontWeight: "700", fontSize: 16 },
  cancelFormButton: { alignItems: "center", padding: 12 },
  cancelFormText: { color: "#6b7080", fontSize: 15 },
});
