package io.github.focusforyou.app;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
// Only the public PKCE request and a short-lived authorization code cross the app link.
final class SpotifyAuth {
 static final String CLIENT="7b55cc63b3134323afc047bbe00f4aa4";
 static final String REDIRECT="https://focusforyou.github.io/spotify-callback.html";
 static final long MAX_AGE=600000;
 static Map<String,String> query(URI uri) throws Exception {
  Map<String,String> values=new HashMap<>();
  String raw=uri.getRawQuery();if(raw==null||raw.length()>8192)throw new IllegalArgumentException();
  for(String part:raw.split("&")){String[] pair=part.split("=",2);String key=URLDecoder.decode(pair[0],"UTF-8"),value=pair.length==2?URLDecoder.decode(pair[1],"UTF-8"):"";if(values.put(key,value)!=null)throw new IllegalArgumentException();}
  return values;
 }
 static String authorizeState(String value){try{
  URI uri=new URI(value);if(!"https".equals(uri.getScheme())||!"accounts.spotify.com".equals(uri.getHost())||uri.getPort()!=-1||uri.getUserInfo()!=null||uri.getFragment()!=null||!"/authorize".equals(uri.getPath()))return null;
  Map<String,String> q=query(uri);String state=q.get("state");if(q.size()!=7)return null;
  if(!CLIENT.equals(q.get("client_id"))||!REDIRECT.equals(q.get("redirect_uri"))||!"code".equals(q.get("response_type"))||!"S256".equals(q.get("code_challenge_method"))||!"user-read-playback-state user-modify-playback-state".equals(q.get("scope"))||state==null||!state.matches("android_[A-Za-z0-9_-]{16,80}")||q.get("code_challenge")==null||!q.get("code_challenge").matches("[A-Za-z0-9_-]{43}"))return null;
  return state;
 }catch(Exception ignored){return null;}}
 static Map<String,String> callback(String value,String expected,long created,long now){try{
  if(expected==null||expected.isEmpty()||created<=0||now<created||now-created>MAX_AGE)return null;
  URI uri=new URI(value);if(!"focusforyou".equals(uri.getScheme())||!"spotify-callback".equals(uri.getHost())||uri.getPort()!=-1||uri.getUserInfo()!=null||uri.getFragment()!=null||!(uri.getPath()==null||uri.getPath().isEmpty()||"/".equals(uri.getPath())))return null;
  Map<String,String> q=query(uri);String state=q.get("state"),code=q.get("code"),error=q.get("error");if(q.size()!=2)return null;
  if(state==null||!MessageDigest.isEqual(expected.getBytes("UTF-8"),state.getBytes(StandardCharsets.UTF_8))||(code==null)==(error==null)||code!=null&&(code.isEmpty()||code.length()>4096)||error!=null&&(error.isEmpty()||error.length()>256))return null;
  return q;
 }catch(Exception ignored){return null;}}
}
