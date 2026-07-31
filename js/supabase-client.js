(function () {
  "use strict";

  var SUPABASE_URL = "https://eewmeannakelztffftaf.supabase.co";
  var SUPABASE_PUBLIC_KEY = "sb_publishable_CC1tYHFA5ho8aHjj-KQ0oQ_UDAZPeAH";
  var client = null;

  function getConfig() {
    return {
      url: SUPABASE_URL,
      publicKey: SUPABASE_PUBLIC_KEY
    };
  }

  function getClient() {
    if (client) {
      return client;
    }

    if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
      throw new Error("Supabase public URL or key is missing.");
    }

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase library is unavailable.");
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
    return client;
  }

  window.SiteSupabase = {
    getClient: getClient,
    getConfig: getConfig
  };
}());
