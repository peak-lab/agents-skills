import io
import unittest
import urllib.error
import urllib.request
from email.utils import formatdate
from unittest.mock import call, patch

import plane_client


def http_error(code, retry_after=None):
    headers = {} if retry_after is None else {"Retry-After": retry_after}
    return urllib.error.HTTPError(
        "https://plane.example/api/v1/test",
        code,
        "request failed",
        headers,
        io.BytesIO(b"error"),
    )


class PlaneClientRetryTests(unittest.TestCase):
    def setUp(self):
        self.request = urllib.request.Request("https://plane.example/api/v1/test")

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_returns_immediate_success_without_sleeping(self, urlopen, sleep):
        response = object()
        urlopen.return_value = response

        result = plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        self.assertIs(result, response)
        urlopen.assert_called_once_with(self.request, timeout=30)
        sleep.assert_not_called()

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_honors_retry_after_seconds_for_429(self, urlopen, sleep):
        error = http_error(429, "7")
        response = object()
        urlopen.side_effect = [error, response]

        result = plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        self.assertIs(result, response)
        sleep.assert_called_once_with(7.0)
        self.assertTrue(error.fp.closed)

    @patch("plane_client.time.time", return_value=1_700_000_000)
    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_honors_retry_after_http_date(self, urlopen, sleep, _time):
        error = http_error(429, formatdate(1_700_000_012, usegmt=True))
        urlopen.side_effect = [error, object()]

        plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        sleep.assert_called_once_with(12.0)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_caps_large_retry_after_seconds(self, urlopen, sleep):
        urlopen.side_effect = [http_error(429, "3600"), object()]

        plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        sleep.assert_called_once_with(30.0)

    @patch("plane_client.time.time", return_value=1_700_000_000)
    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_caps_far_future_retry_after_http_date(self, urlopen, sleep, _time):
        error = http_error(429, formatdate(1_700_086_400, usegmt=True))
        urlopen.side_effect = [error, object()]

        plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        sleep.assert_called_once_with(30.0)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_caps_every_retry_after_when_exhausted(self, urlopen, sleep):
        errors = [http_error(429, "3600") for _ in range(5)]
        urlopen.side_effect = errors

        with self.assertRaises(urllib.error.HTTPError):
            plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        self.assertEqual(sleep.call_args_list, [call(30.0)] * 4)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_invalid_retry_after_uses_fallback(self, urlopen, sleep):
        urlopen.side_effect = [http_error(429, "not-a-delay"), object()]

        plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        sleep.assert_called_once_with(2.0)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_transient_5xx_uses_fallback(self, urlopen, sleep):
        urlopen.side_effect = [http_error(503), object()]

        plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        sleep.assert_called_once_with(2.0)
        self.assertEqual(urlopen.call_count, 2)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_other_4xx_is_not_retried(self, urlopen, sleep):
        error = http_error(404)
        urlopen.side_effect = error

        with self.assertRaises(urllib.error.HTTPError) as raised:
            plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        self.assertIs(raised.exception, error)
        self.assertEqual(urlopen.call_count, 1)
        sleep.assert_not_called()
        self.assertTrue(error.fp.closed)

    @patch("plane_client.time.sleep")
    @patch("plane_client.urllib.request.urlopen")
    def test_exhaustion_stops_after_five_calls_and_raises_last_error(
        self, urlopen, sleep
    ):
        errors = [http_error(503) for _ in range(5)]
        urlopen.side_effect = errors

        with self.assertRaises(urllib.error.HTTPError) as raised:
            plane_client.PlaneClient._urlopen_with_retry(self.request, 30)

        self.assertIs(raised.exception, errors[-1])
        self.assertEqual(urlopen.call_count, 5)
        self.assertEqual(
            sleep.call_args_list,
            [call(2.0), call(5.0), call(15.0), call(30.0)],
        )
        self.assertTrue(all(error.fp.closed for error in errors))


if __name__ == "__main__":
    unittest.main()
