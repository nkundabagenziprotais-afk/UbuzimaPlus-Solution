package com.ubuzimaplus.preview

import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

class MainActivity : FlutterActivity() {
    companion object {
        private const val UPDATE_CHANNEL =
            "com.ubuzimaplus.preview/update"

        private const val PREVIEW_PACKAGE =
            "com.ubuzimaplus.preview"

        private const val APPROVED_HOST =
            "ubuzimaplus.com"

        private const val EXPECTED_CERT_SHA256 =
            "f29865dbb2b733cce6cf821d358b5ca5652653dcc25af15a0d5a5272d83d3671"

        private const val MAX_APK_BYTES =
            45_000_000L
    }

    override fun configureFlutterEngine(
        flutterEngine: FlutterEngine
    ) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            UPDATE_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "getAppInfo" ->
                    result.success(installedAppInfo())

                "prepareUpdate" ->
                    prepareUpdate(call, result)

                "installPrepared" ->
                    installPrepared(call, result)

                "openInstallPermission" -> {
                    openInstallPermission()
                    result.success(null)
                }

                else -> result.notImplemented()
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun installedAppInfo(): Map<String, Any> {
        val info =
            packageManager.getPackageInfo(
                packageName,
                0,
            )

        val versionCode =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.P
            ) {
                info.longVersionCode
            } else {
                info.versionCode.toLong()
            }

        return mapOf(
            "packageName" to packageName,
            "versionCode" to versionCode,
            "versionName" to
                (info.versionName ?: ""),
        )
    }

    private fun updateDirectory(): File {
        val directory =
            File(cacheDir, "updates")

        if (
            !directory.exists() &&
            !directory.mkdirs()
        ) {
            throw IllegalStateException(
                "Unable to create update cache."
            )
        }

        return directory.canonicalFile
    }

    private fun prepareUpdate(
        call: MethodCall,
        result: MethodChannel.Result,
    ) {
        val downloadUrl =
            call.argument<String>("downloadUrl")
                ?.trim()
                .orEmpty()

        val expectedSha =
            call.argument<String>("sha256")
                ?.trim()
                ?.lowercase()
                .orEmpty()

        val expectedBytes =
            (
                call.argument<Any>("expectedBytes")
                    as? Number
            )?.toLong() ?: 0L

        Thread {
            try {
                validateDownloadRequest(
                    downloadUrl,
                    expectedSha,
                    expectedBytes,
                )

                val prepared =
                    downloadAndVerify(
                        downloadUrl,
                        expectedSha,
                        expectedBytes,
                    )

                runOnUiThread {
                    result.success(
                        mapOf(
                            "path" to
                                prepared.absolutePath,
                            "bytes" to
                                prepared.length(),
                        )
                    )
                }
            } catch (error: Exception) {
                runOnUiThread {
                    result.error(
                        "UPDATE_PREPARE_FAILED",
                        error.message
                            ?: "Unable to prepare update.",
                        null,
                    )
                }
            }
        }.start()
    }

    private fun installPrepared(
        call: MethodCall,
        result: MethodChannel.Result,
    ) {
        val rawPath =
            call.argument<String>("path")
                ?.trim()
                .orEmpty()

        val expectedSha =
            call.argument<String>("sha256")
                ?.trim()
                ?.lowercase()
                .orEmpty()

        Thread {
            try {
                if (
                    !expectedSha.matches(
                        Regex("^[0-9a-f]{64}$")
                    )
                ) {
                    throw IllegalArgumentException(
                        "Invalid update SHA256."
                    )
                }

                val file =
                    approvedPreparedFile(rawPath)

                if (sha256(file) != expectedSha) {
                    throw SecurityException(
                        "Prepared APK checksum mismatch."
                    )
                }

                verifyCandidate(file)

                val needsPermission =
                    Build.VERSION.SDK_INT >=
                        Build.VERSION_CODES.O &&
                        !packageManager
                            .canRequestPackageInstalls()

                runOnUiThread {
                    try {
                        if (needsPermission) {
                            result.success(
                                "permission_required"
                            )
                        } else {
                            launchPackageInstaller(file)

                            result.success(
                                "installer_started"
                            )
                        }
                    } catch (error: Exception) {
                        result.error(
                            "UPDATE_INSTALL_FAILED",
                            error.message
                                ?: "Unable to launch installer.",
                            null,
                        )
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    result.error(
                        "UPDATE_INSTALL_FAILED",
                        error.message
                            ?: "Unable to install update.",
                        null,
                    )
                }
            }
        }.start()
    }

    private fun validateDownloadRequest(
        downloadUrl: String,
        expectedSha: String,
        expectedBytes: Long,
    ) {
        val url = URL(downloadUrl)

        if (
            !url.protocol.equals(
                "https",
                ignoreCase = true,
            ) ||
            !url.host.equals(
                APPROVED_HOST,
                ignoreCase = true,
            ) ||
            !url.path.startsWith("/downloads/")
        ) {
            throw SecurityException(
                "Update URL is not approved."
            )
        }

        if (
            !expectedSha.matches(
                Regex("^[0-9a-f]{64}$")
            )
        ) {
            throw IllegalArgumentException(
                "Update SHA256 is invalid."
            )
        }

        if (
            expectedBytes < 0 ||
            expectedBytes > MAX_APK_BYTES
        ) {
            throw IllegalArgumentException(
                "Update size is outside release gate."
            )
        }
    }

    private fun downloadAndVerify(
        downloadUrl: String,
        expectedSha: String,
        expectedBytes: Long,
    ): File {
        val directory = updateDirectory()

        val partial =
            File(
                directory,
                "ubuzima-preview-update.apk.part",
            )

        val finalFile =
            File(
                directory,
                "ubuzima-preview-update.apk",
            )

        partial.delete()
        finalFile.delete()

        val connection =
            URL(downloadUrl).openConnection()
                as HttpsURLConnection

        connection.instanceFollowRedirects = false
        connection.connectTimeout = 12_000
        connection.readTimeout = 45_000
        connection.requestMethod = "GET"

        connection.setRequestProperty(
            "Accept",
            "application/vnd.android.package-archive",
        )

        try {
            connection.connect()

            if (connection.responseCode != 200) {
                throw IllegalStateException(
                    "APK download returned HTTP " +
                        connection.responseCode +
                        "."
                )
            }

            val declaredLength =
                connection.contentLengthLong

            if (declaredLength > MAX_APK_BYTES) {
                throw SecurityException(
                    "APK exceeds release size gate."
                )
            }

            val digest =
                MessageDigest.getInstance("SHA-256")

            var total = 0L

            connection.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer =
                        ByteArray(64 * 1024)

                    while (true) {
                        val count =
                            input.read(buffer)

                        if (count < 0) {
                            break
                        }

                        if (count == 0) {
                            continue
                        }

                        total += count

                        if (total > MAX_APK_BYTES) {
                            throw SecurityException(
                                "APK exceeds release size gate."
                            )
                        }

                        digest.update(
                            buffer,
                            0,
                            count,
                        )

                        output.write(
                            buffer,
                            0,
                            count,
                        )
                    }

                    output.fd.sync()
                }
            }

            if (
                expectedBytes > 0 &&
                total != expectedBytes
            ) {
                throw SecurityException(
                    "APK byte count does not match manifest."
                )
            }

            val actualSha =
                hex(digest.digest())

            if (actualSha != expectedSha) {
                throw SecurityException(
                    "Downloaded APK checksum mismatch."
                )
            }

            if (!partial.renameTo(finalFile)) {
                partial.copyTo(
                    finalFile,
                    overwrite = true,
                )

                partial.delete()
            }

            verifyCandidate(finalFile)

            return finalFile
        } catch (error: Exception) {
            partial.delete()
            finalFile.delete()

            throw error
        } finally {
            connection.disconnect()
        }
    }

    private fun approvedPreparedFile(
        rawPath: String
    ): File {
        if (rawPath.isBlank()) {
            throw IllegalArgumentException(
                "Prepared APK path is missing."
            )
        }

        val file =
            File(rawPath).canonicalFile

        val directory =
            updateDirectory()

        if (
            file.parentFile?.canonicalFile !=
            directory
        ) {
            throw SecurityException(
                "Prepared APK is outside update cache."
            )
        }

        if (
            file.name !=
            "ubuzima-preview-update.apk"
        ) {
            throw SecurityException(
                "Prepared APK filename is invalid."
            )
        }

        if (!file.isFile || file.length() <= 0) {
            throw IllegalStateException(
                "Prepared APK is missing."
            )
        }

        if (file.length() > MAX_APK_BYTES) {
            throw SecurityException(
                "Prepared APK exceeds size gate."
            )
        }

        return file
    }

    @Suppress("DEPRECATION")
    private fun verifyCandidate(file: File) {
        val flags =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.P
            ) {
                PackageManager
                    .GET_SIGNING_CERTIFICATES
            } else {
                PackageManager.GET_SIGNATURES
            }

        val archive =
            packageManager.getPackageArchiveInfo(
                file.absolutePath,
                flags,
            )
                ?: throw SecurityException(
                    "Unable to inspect update APK."
                )

        if (archive.packageName != PREVIEW_PACKAGE) {
            throw SecurityException(
                "Update APK package identity mismatch."
            )
        }

        val signatures =
            currentSignatures(archive)

        if (signatures.size != 1) {
            throw SecurityException(
                "Update APK signer count is invalid."
            )
        }

        val signerSha =
            certificateSha256(
                signatures.first(),
            )

        if (signerSha != EXPECTED_CERT_SHA256) {
            throw SecurityException(
                "Update APK signing certificate mismatch."
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun currentSignatures(
        info: PackageInfo
    ): Array<Signature> {
        return if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.P
        ) {
            info.signingInfo
                ?.apkContentsSigners
                ?: emptyArray()
        } else {
            info.signatures ?: emptyArray()
        }
    }

    private fun certificateSha256(
        signature: Signature
    ): String {
        val digest =
            MessageDigest
                .getInstance("SHA-256")
                .digest(
                    signature.toByteArray()
                )

        return hex(digest)
    }

    private fun sha256(file: File): String {
        val digest =
            MessageDigest.getInstance("SHA-256")

        file.inputStream().use { input ->
            val buffer =
                ByteArray(64 * 1024)

            while (true) {
                val count =
                    input.read(buffer)

                if (count < 0) {
                    break
                }

                if (count > 0) {
                    digest.update(
                        buffer,
                        0,
                        count,
                    )
                }
            }
        }

        return hex(digest.digest())
    }

    private fun hex(value: ByteArray): String {
        return value.joinToString("") {
            "%02x".format(
                it.toInt() and 0xff
            )
        }
    }

    private fun launchPackageInstaller(
        file: File
    ) {
        val uri =
            FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                file,
            )

        val intent =
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    uri,
                    "application/vnd.android.package-archive",
                )

                addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }

        startActivity(intent)
    }

    private fun openInstallPermission() {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O
        ) {
            return
        }

        startActivity(
            Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse(
                    "package:$packageName"
                ),
            )
        )
    }
}
