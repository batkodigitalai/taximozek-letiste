<?php
/* TaxiMozek – živá proxy na příletovou tabuli Letiště Praha.
   Nahraj na libovolný PHP hosting (např. batkoai.com/prilety/prilety-proxy.php)
   a adresu vlož v aplikaci do Nastavení → „Adresa živé proxy“.
   Cache 60 s, aby se letiště nezatěžovalo. */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
date_default_timezone_set("Europe/Prague");
$cache = sys_get_temp_dir()."/prg_prilety_cache.json";
if (file_exists($cache) && time()-filemtime($cache) < 60) { readfile($cache); exit; }
$frm = date("d-m-Y")."_00-00"; $all = []; $off = 0;
$ctx = stream_context_create(["http"=>["timeout"=>20, "header"=>"Accept: application/json\r\n"]]);
while ($off < 600) {
  $raw = @file_get_contents("https://api.prg.aero/arrivals-shorttime?offset=$off&limit=200&from=$frm", false, $ctx);
  $b = $raw ? json_decode($raw, true) : null;
  if (!is_array($b) || !count($b)) break;
  foreach ($b as $x) if (!empty($x["isMainFlight"])) $all[] = array_intersect_key($x, array_flip(["time","time-new","flyNumber","destination","destination-id","state","state_id","state-color","terminal","company","company-id","isMainFlight"]));
  $off += count($b); if (count($b) < 200) break;
}
if (!count($all)) { http_response_code(502); echo json_encode(["error"=>"letiste neodpovida"]); exit; }
$out = json_encode(["generated"=>date("c"), "source"=>"api.prg.aero via proxy", "count"=>count($all), "flights"=>$all], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
@file_put_contents($cache, $out); echo $out;
