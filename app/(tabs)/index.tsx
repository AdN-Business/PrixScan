import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const handleScan = async () => {
    if (!permission?.granted) await requestPermission();
    setProduct(null);
    setScanning(true);
  };

  const handleBarcode = async (result: any) => {
    setScanning(false);
    setLoading(true);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${result.data}.json`,
      );
      const data = await response.json();
      if (data.status === 1) setProduct(data.product);
      else alert("Produit non trouvé.");
    } catch (e) {
      alert("Erreur de connexion.");
    }
    setLoading(false);
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
          <Text style={styles.sectionTitle}>💰 Prix par magasin</Text>
          {[
            { name: "Aldi", price: "0,99 €", color: "#00e5a0" },
            { name: "Leclerc", price: "1,05 €", color: "#00e5a0" },
            { name: "Carrefour", price: "1,09 €", color: "#f0f2ff" },
            { name: "Intermarché", price: "1,25 €", color: "#f5c542" },
            { name: "Monoprix", price: "1,49 €", color: "#ff4f4f" },
          ].map((store) => (
            <View key={store.name} style={styles.storeRow}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={[styles.storePrice, { color: store.color }]}>
                {store.price}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
          <Text style={styles.scanText}>📷 Scanner un autre produit</Text>
        </TouchableOpacity>
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
    backgroundColor: "#00e5a0",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 28,
    marginTop: 10,
  },
  scanIcon: { fontSize: 52, marginBottom: 8 },
  scanText: { color: "#0a1a12", fontWeight: "700", fontSize: 15 },
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
  storeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2d3a",
  },
  storeName: { color: "#f0f2ff", fontSize: 15 },
  storePrice: { fontWeight: "700", fontSize: 15 },
});
