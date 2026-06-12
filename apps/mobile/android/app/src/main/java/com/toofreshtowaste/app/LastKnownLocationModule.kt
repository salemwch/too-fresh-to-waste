package com.toofreshtowaste.app

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.location.LocationServices

class LastKnownLocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getLastKnownLocation(promise: Promise) {
        val client = LocationServices.getFusedLocationProviderClient(reactApplicationContext)
        try {
            client.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        val map = Arguments.createMap().apply {
                            putDouble("latitude", location.latitude)
                            putDouble("longitude", location.longitude)
                            putDouble("accuracy", location.accuracy.toDouble())
                            putDouble("timestamp", location.time.toDouble())
                        }
                        promise.resolve(map)
                    } else {
                        promise.resolve(null)
                    }
                }
                .addOnFailureListener { _ ->
                    promise.resolve(null)
                }
        } catch (e: SecurityException) {
            promise.resolve(null)
        }
    }

    companion object {
        const val NAME = "LastKnownLocation"
    }
}
