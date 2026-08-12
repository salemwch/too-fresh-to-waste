import { sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { withAuth } from '../lib/auth.js';
import { checkList, checkOk, data, sample } from '../lib/envelope.js';
import { get, post } from '../lib/http.js';

const SEARCH_TERMS = ['pizza', 'pain', 'salade', 'couscous', 'patisserie', 'sandwich'];

/**
 * Discovery browsing — the cached path through `personalizeOfferPage`, which
 * the project notes describe as the hottest path in the app.
 *
 * The page number and the offer id are randomised deliberately. Always
 * requesting page 1 and always opening the same offer keeps one key permanently
 * warm in Redis and reports a cache hit rate that production will never see;
 * the point of this journey is to exercise misses as well as hits.
 */
export function consumerBrowse(session) {
  const page = randomIntBetween(1, 5);

  const list = withAuth(session, params =>
    get(`/offers?page=${page}&limit=10`, 'offers_list', params),
  );
  checkList(list, 'offers list');

  sleep(randomIntBetween(2, 5));

  const urgent = withAuth(session, params => get('/offers/urgent?limit=5', 'offers_urgent', params));
  checkOk(urgent, 'urgent offers');

  sleep(randomIntBetween(1, 3));

  const offers = data(list);
  const chosen = sample(offers);
  if (chosen && chosen._id) {
    const detail = withAuth(session, params =>
      get(`/offers/${chosen._id}`, 'offer_detail', params),
    );
    checkOk(detail, 'offer detail');
    sleep(randomIntBetween(2, 6));
  }

  const term = SEARCH_TERMS[randomIntBetween(0, SEARCH_TERMS.length - 1)];
  const results = withAuth(session, params =>
    post('/search', { query: term, page: 1, limit: 10 }, 'search', params),
  );
  checkOk(results, 'search');

  sleep(randomIntBetween(3, 8));
}
