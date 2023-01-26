import { proxiedFetch } from "../helpers/fetch";
import { registerProvider } from "../helpers/register";
import { MWStreamType } from "../helpers/streams";
import { MWMediaType } from "../metadata/types";

const netfilmBase = "https://net-film.vercel.app";

registerProvider({
  id: "netfilm",
  displayName: "NetFilm",
  rank: 999,
  type: [MWMediaType.MOVIE, MWMediaType.SERIES],

  async scrape({ media, episode, progress }) {
    // // search for relevant item
    const searchResponse = await proxiedFetch<any>(
      `/api/search?keyword=${encodeURIComponent(media.meta.title)}`,
      {
        baseURL: netfilmBase,
      }
    );

    const searchResults = searchResponse.data.results;
    progress(25);

    if (media.meta.type === MWMediaType.MOVIE) {
      const foundItem = searchResults.find((v: any) => {
        return v.name === media.meta.title && v.releaseTime === media.meta.year;
      });
      if (!foundItem) throw new Error("No watchable item found");
      const netfilmId = foundItem.id;

      // get stream info from media
      progress(75);
      const watchInfo = await proxiedFetch<any>(
        `/api/episode?id=${netfilmId}`,
        {
          baseURL: netfilmBase,
        }
      );

      const { qualities } = watchInfo.data;

      // get best quality source
      const source = qualities.reduce((p: any, c: any) =>
        c.quality > p.quality ? c : p
      );

      return {
        embeds: [],
        stream: {
          streamUrl: source.url,
          quality: source.quality,
          type: MWStreamType.HLS,
          // captions: [],
        },
      };
    }

    if (media.meta.type !== MWMediaType.SERIES)
      throw new Error("Unsupported type");

    const desiredSeason = media.meta.seasonData.number;

    const searchItems = searchResults
      .filter((v: any) => {
        return v.name.includes(media.meta.title);
      })
      .map((v: any) => {
        return {
          ...v,
          season: parseInt(v.name.split(" ").at(-1), 10),
        };
      });

    const foundItem = searchItems.find((v: any) => {
      return v.season === desiredSeason;
    });

    progress(50);
    const seasonDetail = await proxiedFetch<any>(
      `/api/detail?id=${foundItem.id}&category=${foundItem.categoryTag[0].id}`,
      {
        baseURL: netfilmBase,
      }
    );

    const episodeNo = media.meta.seasonData.episodes.find(
      (v: any) => v.id === episode
    )?.number;
    const episodeData = seasonDetail.data.episodeVo.find(
      (v: any) => v.seriesNo === episodeNo
    );

    progress(75);
    const episodeStream = await proxiedFetch<any>(
      `/api/episode?id=${foundItem.id}&category=1&episode=${episodeData.id}`,
      {
        baseURL: netfilmBase,
      }
    );

    const { qualities } = episodeStream.data;

    // get best quality source
    const source = qualities.reduce((p: any, c: any) =>
      c.quality > p.quality ? c : p
    );

    return {
      embeds: [],
      stream: {
        streamUrl: source.url,
        quality: source.quality,
        type: MWStreamType.HLS,
        // captions: [],
      },
    };
  },
});
