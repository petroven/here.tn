import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Maximize2, X } from 'lucide-react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { MapPoint } from '@/api/types';
import { WEB_URL } from '@/config';
import { BRAND, useTheme } from '@/theme/useTheme';

export type MapMarker = MapPoint & {
  id: string;
  kind: 'pickup' | 'dropoff' | 'courier';
  /** Texte de la bulle au toucher (adresse, n° de commande…). */
  label?: string;
};

export type RouteInfo = { distanceKm: number; durationMin: number; exact: boolean };

type Props = {
  markers: MapMarker[];
  /** Points de passage de l'itinéraire, dans l'ordre (ex. livreur → boutique → client). */
  route?: MapPoint[];
  height?: number;
  /** Centre la carte sur le livreur à chaque mise à jour de sa position. */
  followCourier?: boolean;
  onMarkerPress?: (id: string) => void;
  onRoute?: (info: RouteInfo | null) => void;
};

// Rayon du cercle « zone approximative » quand l'adresse exacte n'a pas été trouvée.
const APPROX_RADIUS_M = { delegation: 1500, gouvernorat: 8000 };

// Icônes (traits blancs, style Lucide) : boutique, maison, scooter.
const ICONS = {
  pickup: '<path d="M3 9l1.6-5h14.8L21 9"/><path d="M4 9v11h16V9"/><path d="M9.5 20v-5.5h5V20"/><path d="M3 9h18"/>',
  dropoff: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  courier:
    '<circle cx="6" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><path d="M8.6 17h6.8l2.4-6.5H21"/><path d="M9 8.5h3.5l2.4 4"/>',
};

/**
 * Page Leaflet embarquée : fond CARTO (clair/sombre), repères en goutte,
 * livreur pulsant, itinéraire routier OSRM (repli : trait direct en
 * pointillés), boutons zoom / recentrer. Mises à jour par window.update()
 * sans recharger la page ; messages vers l'app : itinéraire, repère touché.
 */
function mapHtml(dark: boolean) {
  // Fond Esri « Canvas » (gris clair / gris foncé) + noms de rues : moderne, sans clé API.
  const canvas = dark ? 'World_Dark_Gray' : 'World_Light_Gray';
  const tiles = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${canvas}_Base/MapServer/tile/{z}/{y}/{x}`;
  const labels = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${canvas}_Reference/MapServer/tile/{z}/{y}/{x}`;
  const bg = dark ? '#141210' : '#F4ECDF';
  const card = dark ? '#1E1B18' : '#FFFFFF';
  const ink = dark ? '#F4ECDF' : '#1E1B18';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{-webkit-tap-highlight-color:transparent}
html,body,#map{margin:0;height:100%;background:${bg};font-family:-apple-system,Roboto,sans-serif}
.leaflet-control-attribution{font-size:8px;background:${dark ? 'rgba(20,18,16,.6)' : 'rgba(255,255,255,.7)'}!important;color:${dark ? '#8C8378' : '#6b6259'}}
.leaflet-control-attribution a{color:inherit}
.pin{position:relative;width:38px;height:38px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
  border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
.pin svg{transform:rotate(45deg);width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
.courier{width:44px;height:44px;border-radius:50%;background:${BRAND};border:3px solid #fff;
  box-shadow:0 6px 16px rgba(196,83,44,.45);display:flex;align-items:center;justify-content:center;position:relative}
.courier svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.courier:before,.courier:after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2px solid ${BRAND};animation:ring 2s infinite}
.courier:after{animation-delay:1s}
@keyframes ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.4);opacity:0}}
.leaflet-popup-content-wrapper{background:${card};color:${ink};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.leaflet-popup-content{margin:8px 12px;font-size:12px;font-weight:600}
.leaflet-popup-tip{background:${card}}
.ctrl{position:absolute;right:10px;bottom:22px;z-index:1000;display:flex;flex-direction:column;gap:8px}
.ctrl button{width:38px;height:38px;border-radius:12px;border:none;background:${card};color:${ink};
  box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:20px;font-weight:600;display:flex;align-items:center;justify-content:center}
.ctrl svg{width:18px;height:18px;fill:none;stroke:${ink};stroke-width:2.2;stroke-linecap:round}
</style></head><body><div id="map"></div>
<div class="ctrl">
  <button onclick="map.zoomIn()" aria-label="Zoom +">+</button>
  <button onclick="map.zoomOut()" aria-label="Zoom -">&minus;</button>
  <button onclick="recenter(true)" aria-label="Recentrer"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>
</div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true});
L.tileLayer('${tiles}',{maxZoom:16,maxNativeZoom:16,attribution:'Esri, HERE, Garmin, &copy; OpenStreetMap'}).addTo(map);
L.tileLayer('${labels}',{maxZoom:16,maxNativeZoom:16,pane:'overlayPane'}).addTo(map);
map.setView([36.8065,10.1815],11);
var ICONS=${JSON.stringify(ICONS)}, COLORS={pickup:'#1E1B18',dropoff:'#16A34A'};
var RADIUS=${JSON.stringify(APPROX_RADIUS_M)};
var markerLayer=L.layerGroup().addTo(map), routeLayer=L.layerGroup().addTo(map);
var state={markers:[],route:[],follow:false}, fitted=false, routeKey='';
function post(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o));}
function icon(m){
  if(m.kind==='courier')return L.divIcon({className:'',iconSize:[44,44],iconAnchor:[22,22],
    html:'<div class="courier"><svg viewBox="0 0 24 24">'+ICONS.courier+'</svg></div>'});
  return L.divIcon({className:'',iconSize:[38,38],iconAnchor:[19,40],popupAnchor:[0,-38],
    html:'<div class="pin" style="background:'+COLORS[m.kind]+'"><svg viewBox="0 0 24 24">'+ICONS[m.kind]+'</svg></div>'});
}
function bounds(){
  var pts=state.markers.map(function(m){return[m.latitude,m.longitude];});
  routeLayer.eachLayer(function(l){if(l.getLatLngs)l.getLatLngs().forEach(function(p){pts.push([p.lat,p.lng]);});});
  return pts;
}
function recenter(force){
  var c=state.markers.find(function(m){return m.kind==='courier';});
  if(!force&&state.follow&&c){map.panTo([c.latitude,c.longitude]);return;}
  var pts=bounds();if(!pts.length)return;
  if(pts.length===1)map.setView(pts[0],15);else map.fitBounds(pts,{padding:[46,46],maxZoom:15});
}
function drawRoute(coords,exact){
  routeLayer.clearLayers();
  if(coords.length<2)return;
  L.polyline(coords,{color:'#fff',weight:9,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(routeLayer);
  L.polyline(coords,{color:'${BRAND}',weight:5,opacity:.95,lineCap:'round',lineJoin:'round',dashArray:exact?null:'2 10'}).addTo(routeLayer);
}
function haversine(a,b){var R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;
  var x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)*Math.sin(dg/2);
  return 2*R*Math.asin(Math.sqrt(x));}
function computeRoute(){
  var pts=state.route||[];
  var key=pts.map(function(p){return p.latitude.toFixed(4)+','+p.longitude.toFixed(4);}).join(';');
  if(key===routeKey)return; routeKey=key;
  if(pts.length<2){routeLayer.clearLayers();post({type:'route',route:null});return;}
  var ll=pts.map(function(p){return[p.latitude,p.longitude];});
  var url='https://router.project-osrm.org/route/v1/driving/'+pts.map(function(p){return p.longitude+','+p.latitude;}).join(';')+'?overview=full&geometries=geojson';
  var done=false;
  var fallback=function(){if(done)return;done=true;drawRoute(ll,false);
    var d=0;for(var i=1;i<ll.length;i++)d+=haversine(ll[i-1],ll[i]);
    post({type:'route',route:{distanceKm:d*1.3,durationMin:d*1.3/25*60,exact:false}});if(!fitted){recenter(true);fitted=true;}};
  setTimeout(fallback,6000);
  fetch(url).then(function(r){return r.json();}).then(function(j){
    if(done)return;var rt=j.routes&&j.routes[0];if(!rt)return fallback();done=true;
    drawRoute(rt.geometry.coordinates.map(function(c){return[c[1],c[0]];}),true);
    post({type:'route',route:{distanceKm:rt.distance/1000,durationMin:rt.duration/60,exact:true}});
    if(!fitted){recenter(true);fitted=true;}
  }).catch(fallback);
}
map.on('click',function(){if(state.expandOnTap)post({type:'expand'});});
window.update=function(s){
  state=s;markerLayer.clearLayers();
  s.markers.forEach(function(m){
    if(m.precision&&RADIUS[m.precision])L.circle([m.latitude,m.longitude],{radius:RADIUS[m.precision],
      color:COLORS[m.kind]||'${BRAND}',weight:1,fillOpacity:.1}).addTo(markerLayer);
    var mk=L.marker([m.latitude,m.longitude],{icon:icon(m),zIndexOffset:m.kind==='courier'?1000:0}).addTo(markerLayer);
    if(m.label)mk.bindPopup(m.label);
    mk.on('click',function(){post({type:'tap',id:m.id});});
  });
  computeRoute();
  if(!fitted){recenter(true);if(!(s.route&&s.route.length>1))fitted=true;}
  else if(s.follow)recenter(false);
};
</script></body></html>`;
}

type ViewProps = Props & { expandOnTap?: boolean; onExpand?: () => void; fill?: boolean };

function MapWebView({
  markers,
  route,
  height = 240,
  followCourier,
  onMarkerPress,
  onRoute,
  expandOnTap,
  onExpand,
  fill,
}: ViewProps) {
  const { isDark, colors } = useTheme();
  const webview = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const html = useMemo(() => mapHtml(isDark), [isDark]);
  const payload = JSON.stringify({ markers, route: route ?? [], follow: !!followCourier, expandOnTap: !!expandOnTap });

  // Envoi de l'état à chaque changement, une fois la page chargée.
  useEffect(() => {
    if (loaded) webview.current?.injectJavaScript(`window.update && window.update(${payload}); true;`);
  }, [payload, loaded]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'tap') onMarkerPress?.(msg.id);
      if (msg.type === 'route') onRoute?.(msg.route);
      if (msg.type === 'expand') onExpand?.();
    } catch {
      // message inattendu : ignoré
    }
  };

  return (
    <View
      style={fill ? { flex: 1 } : { height }}
      className={`overflow-hidden bg-surface-muted dark:bg-surface-dark-muted ${fill ? '' : 'rounded-2xl'}`}
    >
      {failed ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-sm text-ink-muted dark:text-gray-400">
            Carte indisponible (connexion requise).
          </Text>
        </View>
      ) : (
        <WebView
          ref={webview}
          originWhitelist={['*']}
          // Les tuiles exigent un Referer : la page reçoit l'origine du site.
          source={{ html, baseUrl: WEB_URL }}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onMessage={onMessage}
          nestedScrollEnabled
          scrollEnabled={false}
          javaScriptEnabled
          style={{ backgroundColor: colors.surface }}
        />
      )}
    </View>
  );
}

/**
 * Carte moderne partagée (suivi client, courses du livreur). Toucher la carte
 * (ou le bouton d'agrandissement) l'ouvre en plein écran.
 */
export function LiveMap(props: Props & { title?: string }) {
  const [full, setFull] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View>
      <MapWebView {...props} expandOnTap onExpand={() => setFull(true)} />
      <Pressable
        onPress={() => setFull(true)}
        className="absolute end-2.5 top-2.5 h-9 w-9 items-center justify-center rounded-xl bg-white/95 dark:bg-surface-dark-card"
        style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Plein écran"
        hitSlop={6}
      >
        <Maximize2 size={17} color={colors.text} />
      </Pressable>

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <MapWebView
            {...props}
            fill
            onMarkerPress={
              props.onMarkerPress
                ? (id) => {
                    setFull(false);
                    props.onMarkerPress?.(id);
                  }
                : undefined
            }
          />
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12 }}
            className="flex-row items-center gap-2"
          >
            <Pressable
              onPress={() => setFull(false)}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-surface-dark-card"
              style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer la carte"
            >
              <X size={20} color={colors.text} />
            </Pressable>
            {props.title ? (
              <View
                className="rounded-2xl bg-white px-4 py-2.5 dark:bg-surface-dark-card"
                style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }}
              >
                <Text className="text-sm font-bold text-ink dark:text-gray-100" numberOfLines={1}>
                  {props.title}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** « 12 min · 4,3 km » */
export function formatRoute(info: RouteInfo, lang: string) {
  const km = info.distanceKm.toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-TN', { maximumFractionDigits: 1 });
  const min = Math.max(1, Math.round(info.durationMin));
  return `${min} min · ${km} km`;
}
